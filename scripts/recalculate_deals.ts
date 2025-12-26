import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type RateType = 'AGENT' | 'ROP';

type DealRow = {
  id: string;
  commission: number;
  taxRate: number;
  brokerExpense: number | null;
  lawyerExpense: number | null;
  referralExpense: number | null;
  otherExpense: number | null;
  externalExpenses: number | null;
  agentId: string;
  ropId: string | null;
  depositDate: Date;
  agentRateApplied: number | null;
  ropRateApplied: number | null;
  agentCommission: number | null;
  ropCommission: number | null;
  netProfit: number | null;
  status: string;
};

function parseArgs() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const excludeCancelled = args.includes('--exclude-cancelled');
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.split('=')[1]) : undefined;
  return { dryRun, excludeCancelled, limit };
}

async function getRateForEmployeeAtDate(employeeId: string, type: RateType, at: Date) {
  const latest = await prisma.commissionRate.findFirst({
    where: { employeeId, type, effectiveDate: { lte: at } },
    orderBy: { effectiveDate: 'desc' }
  });
  return latest?.rate ?? null;
}

function normalizeExpenses(d: {
  brokerExpense?: number | null;
  lawyerExpense?: number | null;
  referralExpense?: number | null;
  otherExpense?: number | null;
  externalExpenses?: number | null;
}) {
  const brokerExpense = Number(d.brokerExpense ?? 0);
  const lawyerExpense = Number(d.lawyerExpense ?? 0);
  const referralExpense = Number(d.referralExpense ?? 0);
  let otherExpense = Number(d.otherExpense ?? 0);
  const externalExpenses = Number(d.externalExpenses ?? 0);

  const breakdownSum = brokerExpense + lawyerExpense + referralExpense + otherExpense;
  if (breakdownSum === 0 && externalExpenses !== 0) {
    otherExpense = externalExpenses;
  }

  return {
    brokerExpense,
    lawyerExpense,
    referralExpense,
    otherExpense,
    externalExpenses: brokerExpense + lawyerExpense + referralExpense + otherExpense
  };
}

function computeWaterfall(params: {
  grossCommission: number;
  taxRatePercent: number;
  referralExpense: number;
  brokerExpense: number;
  lawyerExpense: number;
  otherExpense: number;
  agentRatePercent: number;
  ropRatePercent: number;
}) {
  const taxes = params.grossCommission * (params.taxRatePercent / 100);
  const commissionBase = params.grossCommission - params.referralExpense;
  const ropCommission = commissionBase * (params.ropRatePercent / 100);
  const agentCommission = commissionBase * (params.agentRatePercent / 100);
  const nonReferralExpenses = params.brokerExpense + params.lawyerExpense + params.otherExpense;
  const netProfit =
    params.grossCommission -
    taxes -
    params.referralExpense -
    ropCommission -
    agentCommission -
    nonReferralExpenses;

  return {
    taxes,
    cleanedBase: commissionBase,
    ropCommission,
    agentCommission,
    netProfit
  };
}

function sameNumber(a: number | null, b: number | null) {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return Math.abs(a - b) < 1e-6;
}

async function main() {
  const { dryRun, excludeCancelled, limit } = parseArgs();

  const where: any = { commissionsManual: false };
  if (excludeCancelled) {
    where.status = { not: 'CANCELLED' };
  }

  const deals = await prisma.deal.findMany({
    where,
    orderBy: { depositDate: 'desc' },
    take: limit,
    select: {
      id: true,
      commission: true,
      taxRate: true,
      brokerExpense: true,
      lawyerExpense: true,
      referralExpense: true,
      otherExpense: true,
      externalExpenses: true,
      agentId: true,
      ropId: true,
      depositDate: true,
      agentRateApplied: true,
      ropRateApplied: true,
      agentCommission: true,
      ropCommission: true,
      netProfit: true,
      status: true
    }
  });

  const employeeIds = new Set<string>();
  for (const d of deals) {
    employeeIds.add(d.agentId);
    if (d.ropId) employeeIds.add(d.ropId);
  }
  const employees = await prisma.employee.findMany({
    where: { id: { in: Array.from(employeeIds) } },
    select: { id: true, baseRateAgent: true, baseRateROP: true }
  });
  const employeeById = new Map(employees.map(e => [e.id, e]));

  let updated = 0;
  let skipped = 0;
  let filledRates = 0;
  let fallbackExternal = 0;
  let netBefore = 0;
  let netAfter = 0;

  for (const deal of deals) {
    const expenses = normalizeExpenses(deal);
    const breakdownSum =
      expenses.brokerExpense + expenses.lawyerExpense + expenses.referralExpense + expenses.otherExpense;
    if (breakdownSum === 0 && Number(deal.externalExpenses ?? 0) !== 0) {
      fallbackExternal += 1;
    }

    const agentEmployee = employeeById.get(deal.agentId);
    const ropEmployee = deal.ropId ? employeeById.get(deal.ropId) : null;

    let agentRate = deal.agentRateApplied;
    if (agentRate == null) {
      agentRate =
        (await getRateForEmployeeAtDate(deal.agentId, 'AGENT', deal.depositDate)) ??
        agentEmployee?.baseRateAgent ??
        0;
      filledRates += 1;
    }

    let ropRate = deal.ropRateApplied;
    if (deal.ropId) {
      if (ropRate == null) {
        ropRate =
          (await getRateForEmployeeAtDate(deal.ropId, 'ROP', deal.depositDate)) ??
          ropEmployee?.baseRateROP ??
          0;
        filledRates += 1;
      }
    } else {
      ropRate = 0;
    }

    const waterfall = computeWaterfall({
      grossCommission: Number(deal.commission ?? 0),
      taxRatePercent: Number(deal.taxRate ?? 0),
      referralExpense: expenses.referralExpense,
      brokerExpense: expenses.brokerExpense,
      lawyerExpense: expenses.lawyerExpense,
      otherExpense: expenses.otherExpense,
      agentRatePercent: agentRate ?? 0,
      ropRatePercent: ropRate ?? 0
    });

    netBefore += deal.netProfit ?? 0;
    netAfter += waterfall.netProfit;

    const next = {
      agentRateApplied: agentRate,
      ropRateApplied: ropRate,
      agentCommission: waterfall.agentCommission,
      ropCommission: waterfall.ropCommission,
      netProfit: waterfall.netProfit,
      brokerExpense: expenses.brokerExpense,
      lawyerExpense: expenses.lawyerExpense,
      referralExpense: expenses.referralExpense,
      otherExpense: expenses.otherExpense,
      externalExpenses: expenses.externalExpenses
    };

    const changed =
      !sameNumber(deal.agentRateApplied, next.agentRateApplied) ||
      !sameNumber(deal.ropRateApplied, next.ropRateApplied) ||
      !sameNumber(deal.agentCommission, next.agentCommission) ||
      !sameNumber(deal.ropCommission, next.ropCommission) ||
      !sameNumber(deal.netProfit, next.netProfit) ||
      !sameNumber(deal.brokerExpense, next.brokerExpense) ||
      !sameNumber(deal.lawyerExpense, next.lawyerExpense) ||
      !sameNumber(deal.referralExpense, next.referralExpense) ||
      !sameNumber(deal.otherExpense, next.otherExpense) ||
      !sameNumber(deal.externalExpenses, next.externalExpenses);

    if (!changed) {
      skipped += 1;
      continue;
    }

    if (!dryRun) {
      await prisma.deal.update({
        where: { id: deal.id },
        data: next
      });
    }
    updated += 1;
  }

  console.log('--- Recalculate Deals ---');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLY'}`);
  console.log(`Deals scanned: ${deals.length}`);
  console.log(`Updated: ${updated}`);
  console.log(`Unchanged: ${skipped}`);
  console.log(`Rates filled (missing): ${filledRates}`);
  console.log(`Fallback external->other used: ${fallbackExternal}`);
  console.log(`Net profit sum (before): ${netBefore.toFixed(2)}`);
  console.log(`Net profit sum (after): ${netAfter.toFixed(2)}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

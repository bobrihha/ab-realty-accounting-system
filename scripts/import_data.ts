import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { PrismaClient, Role, Status, DealStatus, ContractType, CashFlowType, AccountType } from '@prisma/client';

const prisma = new PrismaClient();
const IMPORT_DIR = path.join(process.cwd(), 'import_data');

// Expected filenames
const FILES = {
  EMPLOYEES: 'employees.csv',
  DEALS: 'deals.csv',
  CASH_FLOW: 'cash_flow.csv',
  ACCOUNTS: 'accounts.csv',
};

// Helper: Transliterate Cyrillic to Latin for emails
function transliterate(word: string) {
  const answer = [];
  const converter: Record<string, string> = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd',
    'е': 'e', 'ё': 'e', 'ж': 'zh', 'з': 'z', 'и': 'i',
    'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n',
    'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't',
    'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'c', 'ч': 'ch',
    'ш': 'sh', 'щ': 'sch', 'ь': '', 'ы': 'y', 'ъ': '',
    'э': 'e', 'ю': 'yu', 'я': 'ya',
    'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D',
    'Е': 'E', 'Ё': 'E', 'Ж': 'Zh', 'З': 'Z', 'И': 'I',
    'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N',
    'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T',
    'У': 'U', 'Ф': 'F', 'Х': 'H', 'Ц': 'C', 'Ч': 'Ch',
    'Ш': 'Sh', 'Щ': 'Sch', 'Ь': '', 'Ы': 'Y', 'Ъ': '',
    'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya'
  };

  for (let i = 0; i < word.length; ++i) {
    if (converter[word[i]] === undefined) {
      answer.push(word[i]);
    } else {
      answer.push(converter[word[i]]);
    }
  }

  return answer.join('').toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function main() {
  console.log('Starting data import (v2 - Russian Support)...');

  if (!fs.existsSync(IMPORT_DIR)) {
    console.error(`Import directory not found: ${IMPORT_DIR}`);
    process.exit(1);
  }

  // 1. Accounts
  await importAccounts();

  // 2. Employees
  await importEmployees();

  // 3. Deals
  await importDeals();

  // 4. Cash Flow
  await importCashFlow();

  console.log('Data import completed successfully.');
}

async function importAccounts() {
  // Default accounts
  const defaultAccounts = ['Sberbank', 'Tinkoff', 'Cash Desk'];
  for (const name of defaultAccounts) {
    const exists = await prisma.account.findUnique({ where: { name } });
    if (!exists) {
      await prisma.account.create({
        data: {
          name,
          type: 'BANK',
        },
      });
      console.log(`Created default account: ${name}`);
    }
  }
}

async function importEmployees() {
  const filePath = path.join(IMPORT_DIR, FILES.EMPLOYEES);
  if (!fs.existsSync(filePath)) {
    return;
  }

  console.log(`Importing Employees from ${FILES.EMPLOYEES}...`);
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  // Read all lines to find header
  const records = parse(fileContent, {
    columns: (header) => header.map((h: string) => h.trim()),
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true,
  });

  for (const row of records) {
    // Look for ФИО
    const name = row['ФИО'] || row['name'] || row['Name'];

    if (!name || name === 'ФИО') continue; // Skip header or empty

    // Generate fake email if missing
    let email = row['email'] || row['Email'];
    if (!email) {
      const slug = transliterate(name);
      email = `${slug}@ab-realty.ru`;
    }

    try {
      await prisma.employee.upsert({
        where: { email },
        update: {
          name,
          role: 'AGENT',
          status: 'ACTIVE',
        },
        create: {
          name,
          email,
          phone: '',
          role: 'AGENT',
          status: 'ACTIVE',
          hireDate: new Date(),
          baseRateAgent: 50, // Default 50%
        },
      });
      console.log(`Upserted employee: ${name} (${email})`);
    } catch (e) {
      console.error(`Error importing employee ${name}:`, e);
    }
  }
}

async function importDeals() {
  const filePath = path.join(IMPORT_DIR, FILES.DEALS);
  if (!fs.existsSync(filePath)) {
    return;
  }

  const parseNumber = (value: unknown) => {
    if (value === null || value === undefined) return 0;
    const s = String(value)
      .replace(/[\s\u00A0]/g, '')
      .replace(/₽/g, '')
      .replace(',', '.')
      .trim();
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  };

  const parseDateRu = (value: unknown): Date | null => {
    if (!value) return null;
    const raw = String(value).trim();
    if (!raw) return null;
    // DD.MM.YYYY or DD/MM/YYYY
    const m = raw.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
    if (m) {
      const dd = m[1].padStart(2, '0');
      const mm = m[2].padStart(2, '0');
      const yyyy = m[3];
      const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
  };

  const normalize = (value: unknown) =>
    String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');

  const mapStatus = (textRaw: unknown): DealStatus => {
    const text = normalize(textRaw);
    if (!text) return 'DEPOSIT';

    if (text.includes('расторг') || text.includes('срыв') || text.includes('отмен')) return 'CANCELLED';
    if (parseDateRu(text)) return 'CLOSED';

    if (text.includes('на оплат') || text.includes('оплат')) return 'WAITING_PAYMENT';
    if (text.includes('жд') && (text.includes('счет') || text.includes('счёт') || text.includes('выстав'))) return 'WAITING_INVOICE';
    if (text.includes('регистр')) return 'REGISTRATION';
    if (text.includes('задат') || text.includes('брон')) return 'DEPOSIT';
    if (text.includes('закрыт') || text.includes('деньги')) return 'CLOSED';

    return 'DEPOSIT';
  };

  const mapContractType = (textRaw: unknown): ContractType => {
    const text = normalize(textRaw);
    if (text.includes('застрой')) return 'DEVELOPER';
    if (text.includes('подбор') || text.includes('selection')) return 'SELECTION';
    if (text.includes('договор продав') || (text.includes('продав') && text.includes('договор'))) return 'SELLER';
    return 'EXCLUSIVE';
  };

  console.log(`Importing Deals from ${FILES.DEALS}...`);
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const lines = fileContent.split(/\r?\n/);

  // Find header line index
  let headerLineIndex = -1;
  let headers: string[] = [];

  for (let i = 0; i < Math.min(20, lines.length); i++) {
    // Split by comma (naive split, but enough to find unique keywords)
    // Actually better to use csv-parse on the line properly
    if (lines[i].includes('АГЕНТ') && lines[i].includes('СТОИМОСТЬ')) {
      headerLineIndex = i;
      break;
    }
  }

  if (headerLineIndex === -1) {
    console.error('Could not find Deals header row.');
    return;
  }

  console.log(`Deals header found at line ${headerLineIndex + 1}`);

  // Parse EVERYTHING as arrays
  const records = parse(fileContent, {
    columns: false,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true,
  });

  // The 'records' array includes the top garbage lines.
  // headerLineIndex corresponds to the index in 'lines', which roughly matches 'records' 
  // but 'csv-parse' might skip empty lines differently.
  // Safer to find the header row inside 'records'.

  let headerRowIndex = -1;
  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    if (row.includes('АГЕНТ') && row.includes('СТОИМОСТЬ')) {
      headerRowIndex = i;
      headers = row;
      break;
    }
  }

  if (headerRowIndex === -1) {
    console.error('Parsed records do not contain the header row.');
    return;
  }

  // Find Indices
  // We want the FIRST 'АГЕНТ'
  const colAgent = headers.indexOf('АГЕНТ');
  const colClient = headers.indexOf('ПОКУПАТЕЛЬ');
  const colObject = headers.indexOf('ОБЪЕКТ');
  const colObjectAlt = headers.indexOf('ПРОДАВЕЦ'); // fallback
  const colPrice = headers.indexOf('СТОИМОСТЬ');
  const colDate = headers.indexOf('ЗАДАТОК');
  const colDealDate = headers.indexOf('СДЕЛКА');
  const colCommission = headers.indexOf('КОМ-СИЯ') !== -1 ? headers.indexOf('КОМ-СИЯ') : headers.indexOf('КОМИССИЯ');
  const colTaxAmount = headers.indexOf('НАЛОГ');
  const colRopName = 0; // first column in this CSV often contains ROP name ("Без РОПА" or a surname)
  const colRopAmount = headers.indexOf('РОП');
  const colAgentAmount = headers.indexOf('АГЕНТ', colAgent + 1); // second "АГЕНТ" column (payout)
  const colLawyer = headers.indexOf('ЮРИСТ');
  const colBroker = headers.indexOf('брокер');
  const colNetProfit = headers.indexOf('ЧИСТО');
  const colStatus =
    headers.indexOf('СТАТУС') !== -1
      ? headers.indexOf('СТАТУС')
      : headers.indexOf('на задатке') !== -1
        ? headers.indexOf('на задатке')
        : headers.indexOf('РЕ-ЦИЯ');
  const colContract = headers.indexOf('ЭД');

  console.log(`Mappings: Agent=${colAgent}, Client=${colClient}, Price=${colPrice}, Object=${colObject !== -1 ? colObject : colObjectAlt}, Date=${colDate}`);

  if (colAgent === -1 || colClient === -1) {
    console.error('Critical columns missing in Deals CSV.');
    return;
  }

  for (let i = headerRowIndex + 1; i < records.length; i++) {
    const row = records[i];
    // Safety check length
    if (row.length <= colAgent) continue;

    const agentNameRaw = row[colAgent];
    const client = row[colClient];
    if (!client || !agentNameRaw) continue;

    // Object
    let object = 'Unknown';
    if (colObject !== -1) object = row[colObject];
    else if (colObjectAlt !== -1) object = row[colObjectAlt];

    const price = colPrice !== -1 ? parseNumber(row[colPrice]) : 0;

    const depositDate = (colDate !== -1 ? parseDateRu(row[colDate]) : null) ?? new Date();

    const dealDateRaw = colDealDate !== -1 ? row[colDealDate] : null;
    const dealDateParsed = parseDateRu(dealDateRaw);

    const commission = colCommission !== -1 ? parseNumber(row[colCommission]) : 0;
    const taxAmount = colTaxAmount !== -1 ? parseNumber(row[colTaxAmount]) : 0;
    const taxRate = commission > 0 && taxAmount > 0 ? Math.round((taxAmount / commission) * 10000) / 100 : 6;

    const lawyerExpense = colLawyer !== -1 ? parseNumber(row[colLawyer]) : 0;
    const brokerExpense = colBroker !== -1 ? parseNumber(row[colBroker]) : 0;
    const referralExpense = 0;
    const otherExpense = 0;
    const externalExpenses = lawyerExpense + brokerExpense + referralExpense + otherExpense;

    const status = colStatus !== -1 ? mapStatus(row[colStatus]) : 'DEPOSIT';
    const contractType = colContract !== -1 ? mapContractType(row[colContract]) : 'EXCLUSIVE';

    const agentPayout = colAgentAmount !== -1 ? parseNumber(row[colAgentAmount]) : 0;
    const ropPayout = colRopAmount !== -1 ? parseNumber(row[colRopAmount]) : 0;
    const netProfit = colNetProfit !== -1 ? parseNumber(row[colNetProfit]) : 0;

    const ropNameRaw = colRopName !== -1 ? row[colRopName] : '';
    const ropName = normalize(ropNameRaw);

    // Normalize agent name
    const cleanAgentName = agentNameRaw.trim();

    // Find agent
    const agent = await prisma.employee.findFirst({
      where: {
        OR: [
          { name: { contains: cleanAgentName } },
          { email: { contains: transliterate(cleanAgentName) } }
        ]
      }
    });

    if (!agent) {
      // Try creating if missing? No, user provided exact list.
      console.warn(`Warning: Agent '${cleanAgentName}' not found for deal '${client}'. Check employee list.`);
      continue;
    }

    let ropId: string | null = null;
    if (ropName && ropName !== 'без ропа' && ropName !== 'без роп' && ropName !== '-') {
      const rop = await prisma.employee.findFirst({
        where: {
          role: 'ROP',
          OR: [{ name: { contains: ropNameRaw.trim() } }, { email: { contains: transliterate(String(ropNameRaw)) } }]
        }
      });
      ropId = rop?.id ?? null;
    } else if (agent.managerId) {
      ropId = agent.managerId;
    }

    const depositStart = new Date(depositDate);
    depositStart.setHours(0, 0, 0, 0);
    const depositEnd = new Date(depositStart);
    depositEnd.setDate(depositEnd.getDate() + 1);

    try {
      const existing = await prisma.deal.findFirst({
        where: {
          agentId: agent.id,
          client,
          object,
          depositDate: { gte: depositStart, lt: depositEnd }
        }
      });

      const data = {
        client,
        object,
        price,
        commission,
        agentId: agent.id,
        ropId,
        status,
        depositDate,
        contractType,
        taxRate,
        brokerExpense,
        lawyerExpense,
        referralExpense,
        otherExpense,
        externalExpenses,
        commissionsManual: true,
        ropCommission: ropPayout || null,
        agentCommission: agentPayout || null,
        netProfit: netProfit || null,
        dealDate: status === 'CLOSED' ? dealDateParsed ?? null : null,
        plannedCloseDate: status !== 'CLOSED' ? dealDateParsed ?? null : null
      } as const;

      if (existing) {
        await prisma.deal.update({ where: { id: existing.id }, data });
      } else {
        await prisma.deal.create({ data });
      }
      process.stdout.write('.');
    } catch (e) {
      console.error(`Error deal ${client}: ${e}`);
    }
  }
  console.log('\nDeals imported.');
}

async function importCashFlow() {
  const filePath = path.join(IMPORT_DIR, FILES.CASH_FLOW);
  if (!fs.existsSync(filePath)) {
    return;
  }

  console.log(`Importing CashFlow from ${FILES.CASH_FLOW}...`);
  const fileContent = fs.readFileSync(filePath, 'utf-8');

  const records = parse(fileContent, {
    columns: (header) => header.map((h: string) => h.trim()),
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true,
  });

  const defaultAccount = await prisma.account.findFirst();
  if (!defaultAccount) {
    throw new Error('Не найден ни один Account: создайте счет перед импортом.');
  }

  for (const row of records) {
    const category = row['НАИМЕНОВАНИЕ'] || row['category'];
    const amountRaw = row['СУММА'] || row['amount'];

    if (!category || !amountRaw) continue;

    // Skip header repetition if any
    if (category === 'НАИМЕНОВАНИЕ') continue;

    const amount = parseFloat(String(amountRaw).replace(/[\s\u00A0]/g, '').replace(',', '.')) || 0;

    if (amount === 0) continue;

    await prisma.cashFlow.create({
      data: {
        type: 'EXPENSE', // Assume expense
        amount,
        category,
        plannedDate: new Date(),
        actualDate: new Date(),
        status: 'PAID',
        accountId: defaultAccount.id,
        description: row['КОММЕНТАРИЙ'] || '',
      }
    });
  }
  console.log('CashFlow imported.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

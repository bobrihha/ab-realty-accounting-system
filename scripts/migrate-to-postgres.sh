#!/usr/bin/env bash
# PostgreSQL Migration Script - Migrates from SQLite to PostgreSQL

set -euo pipefail

echo "=== PostgreSQL Migration Script ==="
echo ""
echo "This script will:"
echo "1. Update Prisma schema to use PostgreSQL"
echo "2. Generate new Prisma client"
echo "3. Push schema to PostgreSQL database"
echo "4. Initialize clean database with owner user"
echo ""

# Check if DATABASE_URL is set
if [ -z "${DATABASE_URL:-}" ]; then
    echo "Error: DATABASE_URL environment variable is not set"
    echo "Please set it to your PostgreSQL connection string:"
    echo "  export DATABASE_URL='postgresql://user:password@localhost:5432/dbname'"
    exit 1
fi

echo "Using DATABASE_URL: ${DATABASE_URL}"
echo ""

# Backup current schema
cp prisma/schema.prisma prisma/schema.prisma.sqlite.bak
echo "✓ Backed up current schema to prisma/schema.prisma.sqlite.bak"

# Update schema to PostgreSQL
cat > prisma/schema.prisma << 'EOF'
// Система управленческого и финансового учета для агентства недвижимости

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Сотрудники компании
model Employee {
  id            String   @id @default(cuid())
  name          String
  email         String   @unique
  phone         String
  role          Role     // AGENT, ROP, ACCOUNTANT, OWNER
  status        Status   @default(ACTIVE) // ACTIVE, INACTIVE
  department    String?
  hireDate      DateTime
  terminationDate DateTime?
  passwordHash  String?
  baseRateAgent Float?   // Ставка агента в %
  baseRateROP   Float?   // Ставка РОПа в %
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  managerId     String?

  // Связи
  dealsAsAgent  Deal[]   @relation("AgentDeals")
  dealsAsROP    Deal[]   @relation("ROPDeals")
  commissionRates CommissionRate[]
  manager       Employee? @relation("EmployeeManager", fields: [managerId], references: [id])
  subordinates  Employee[] @relation("EmployeeManager")
  payrollAccruals PayrollAccrual[]

  @@map("employees")
}

// История изменения ставок комиссий
model CommissionRate {
  id            String   @id @default(cuid())
  employeeId    String
  rate          Float    // Ставка в %
  type          RateType // AGENT, ROP
  effectiveDate DateTime
  createdAt     DateTime @default(now())

  // Связи
  employee Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)

  @@map("commission_rates")
}

// Сделки
model Deal {
  id              String       @id @default(cuid())
  client          String
  object          String
  price           Float
  commission      Float        // Комиссия агентства
  agentId         String
  ropId           String?
  status          DealStatus   @default(DEPOSIT)
  depositDate     DateTime
  dealDate        DateTime?
  plannedCloseDate DateTime?
  contractType    ContractType @default(EXCLUSIVE)
  legalServices   Boolean      @default(false)
  notes           String?
  taxRate         Float        @default(6) // Ставка налога в %
  // Расходы по сделке (разбивка)
  brokerExpense   Float        @default(0) // Брокер / ипотека
  lawyerExpense   Float        @default(0) // Юрист
  referralExpense Float        @default(0) // Рекомендация
  otherExpense    Float        @default(0) // Прочее
  externalExpenses Float       @default(0) // Сумма расходов (для совместимости/быстрых агрегатов)
  ropCommission   Float?       // Комиссия РОПа (рассчитывается)
  agentCommission Float?       // Комиссия агента (рассчитывается)
  netProfit       Float?       // Чистая прибыль (рассчитывается)
  ropRateApplied  Float?
  agentRateApplied Float?
  commissionsManual Boolean    @default(false)
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  // Связи
  agent           Employee @relation("AgentDeals", fields: [agentId], references: [id])
  rop             Employee? @relation("ROPDeals", fields: [ropId], references: [id])
  payrollAccruals PayrollAccrual[]

  @@map("deals")
}

// Финансовые операции
model CashFlow {
  id          String       @id @default(cuid())
  type        CashFlowType // INCOME, EXPENSE
  amount      Float
  category    String
  status      PaymentStatus @default(PLANNED) // PLANNED (план), PAID (факт)
  plannedDate DateTime
  actualDate  DateTime?
  description String?
  accountId   String?
  createdAt   DateTime     @default(now())

  account     Account?     @relation(fields: [accountId], references: [id], onDelete: SetNull)
  payrollPayments PayrollPayment[]

  @@map("cash_flow")
}

// Счета и кошельки
model Account {
  id        String      @id @default(cuid())
  name      String      @unique
  balance   Float       @default(0)
  type      AccountType // BANK, CASH, DIGITAL
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt

  cashFlows CashFlow[]
  payrollPayments PayrollPayment[]

  @@map("accounts")
}

// Прогноз кассовых разрывов
model CashFlowForecast {
  month            String     @id
  openingBalance   Float
  expectedIncome   Float
  plannedExpenses  Float
  closingBalance   Float
  status           ForecastStatus
  createdAt        DateTime   @default(now())
  updatedAt        DateTime   @updatedAt

  @@map("cash_flow_forecasts")
}

// Начисления и выплаты ЗП (по сделкам)
model PayrollAccrual {
  id         String       @id @default(cuid())
  dealId     String
  employeeId String
  type       PayrollType
  amount     Float
  accruedAt  DateTime
  createdAt  DateTime     @default(now())
  updatedAt  DateTime     @updatedAt

  deal       Deal         @relation(fields: [dealId], references: [id])
  employee   Employee     @relation(fields: [employeeId], references: [id])
  payments   PayrollPayment[]

  @@unique([dealId, employeeId, type])
  @@map("payroll_accruals")
}

model PayrollPayment {
  id         String        @id @default(cuid())
  accrualId  String
  amount     Float
  paidAt     DateTime
  accountId  String
  cashFlowId String?       @unique
  description String?
  createdAt  DateTime      @default(now())

  accrual    PayrollAccrual @relation(fields: [accrualId], references: [id], onDelete: Cascade)
  account    Account       @relation(fields: [accountId], references: [id])
  cashFlow   CashFlow?     @relation(fields: [cashFlowId], references: [id], onDelete: SetNull)

  @@map("payroll_payments")
}

// Enum'ы
enum Role {
  AGENT
  ROP
  ACCOUNTANT
  OWNER
}

enum Status {
  ACTIVE
  INACTIVE
}

enum DealStatus {
  DEPOSIT
  REGISTRATION
  WAITING_INVOICE
  WAITING_PAYMENT
  CLOSED
  CANCELLED
}

enum ContractType {
  EXCLUSIVE
  SELECTION
  DEVELOPER
  SELLER
}

enum PayrollType {
  AGENT
  ROP
}

enum PaymentStatus {
  PLANNED
  PAID
}

enum RateType {
  AGENT
  ROP
}

enum CashFlowType {
  INCOME
  EXPENSE
}

enum AccountType {
  BANK
  CASH
  DIGITAL
}

enum ForecastStatus {
  POSITIVE
  WARNING
  CRITICAL
}
EOF

echo "✓ Updated schema to use PostgreSQL"
echo ""

# Generate Prisma Client
echo "Generating Prisma Client..."
npx prisma generate

echo "✓ Prisma Client generated"
echo ""

# Push schema to database
echo "Pushing schema to PostgreSQL database..."
npx prisma db push --accept-data-loss

echo "✓ Database schema created"
echo ""

# Run seed
echo "Creating owner user..."
npm run db:seed

echo ""
echo "=== Migration Complete ==="
echo ""
echo "✓ PostgreSQL schema created"
echo "✓ Owner user created (owner@agency.local / owner12345)"
echo ""
echo "Your system is ready for production!"

import { db } from '@/lib/db'
import {
    DEFAULT_EXPENSE_BLOCKS,
    DEFAULT_EXPENSE_CATEGORIES,
    DEFAULT_INCOME_CATEGORIES,
    type ExpenseBlockConfig
} from '@/lib/cashflow-defaults'

export type AppSettingsSnapshot = {
    cashflowIncomeCategories: string[]
    cashflowExpenseCategories: string[]
    cashflowExpenseBlocks: ExpenseBlockConfig[]
}

export async function getAppSettings(): Promise<AppSettingsSnapshot> {
    const defaults: AppSettingsSnapshot = {
        cashflowIncomeCategories: DEFAULT_INCOME_CATEGORIES,
        cashflowExpenseCategories: DEFAULT_EXPENSE_CATEGORIES,
        cashflowExpenseBlocks: DEFAULT_EXPENSE_BLOCKS
    }

    const settings = await db.appSettings.findUnique({ where: { id: 'default' } })
    if (!settings) return defaults

    return {
        cashflowIncomeCategories: Array.isArray(settings.cashflowIncomeCategories)
            ? (settings.cashflowIncomeCategories as string[])
            : defaults.cashflowIncomeCategories,
        cashflowExpenseCategories: Array.isArray(settings.cashflowExpenseCategories)
            ? (settings.cashflowExpenseCategories as string[])
            : defaults.cashflowExpenseCategories,
        cashflowExpenseBlocks: Array.isArray(settings.cashflowExpenseBlocks)
            ? (settings.cashflowExpenseBlocks as ExpenseBlockConfig[])
            : defaults.cashflowExpenseBlocks
    }
}

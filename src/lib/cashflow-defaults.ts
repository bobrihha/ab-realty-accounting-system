export type ExpenseBlockConfig = {
    name: string
    categories: string[]
}

export const DEFAULT_EXPENSE_CATEGORIES = [
    'Аренда',
    'Роялти',
    'ЗП HR',
    'ЗП офис-менеджер',
    'ЗП другое',
    'ЗП директора',
    'Налоги',
    'Авито',
    'Циан',
    'Яндекс',
    'ДомКлик',
    'Маркетинг другой',
    'Офис расходы',
    'Другое'
]

export const DEFAULT_INCOME_CATEGORIES = [
    'Комиссия от застройщика',
    'Комиссия от собственника',
    'Комиссия от покупателя',
    'Юр.услуги',
    'Ипотека',
    'Другое'
]

export const DEFAULT_EXPENSE_BLOCKS: ExpenseBlockConfig[] = [
    {
        name: 'Маркетинг',
        categories: ['Авито', 'Циан', 'Яндекс', 'ДомКлик', 'Маркетинг другой']
    },
    {
        name: 'Офисные',
        categories: ['Аренда', 'Роялти', 'Офис расходы']
    },
    {
        name: 'ФОТ',
        categories: ['ЗП HR', 'ЗП офис-менеджер', 'ЗП директора', 'ЗП другое']
    },
    {
        name: 'Другие',
        categories: ['Налоги', 'Другое']
    }
]

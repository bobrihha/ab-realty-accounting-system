'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
    DEFAULT_EXPENSE_BLOCKS,
    DEFAULT_EXPENSE_CATEGORIES,
    DEFAULT_INCOME_CATEGORIES
} from '@/lib/cashflow-defaults'

const toLines = (items: string[]) => items.join('\n')

const parseLines = (value: string) =>
    value
        .split('\n')
        .map(v => v.trim())
        .filter(Boolean)

const blocksToText = (blocks: Array<{ name: string; categories: string[] }>) =>
    blocks
        .map(block => `${block.name}: ${block.categories.join(', ')}`)
        .join('\n')

const parseBlocksText = (value: string) =>
    value
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => {
            const [rawName, rawCategories] = line.split(':')
            const name = (rawName ?? '').trim()
            const categories = rawCategories
                ? rawCategories
                    .split(',')
                    .map(c => c.trim())
                    .filter(Boolean)
                : []
            return name ? { name, categories } : null
        })
        .filter(Boolean) as Array<{ name: string; categories: string[] }>

export function AppSettingsPanel() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [form, setForm] = useState({
        cashflowIncomeCategoriesText: toLines(DEFAULT_INCOME_CATEGORIES),
        cashflowExpenseCategoriesText: toLines(DEFAULT_EXPENSE_CATEGORIES),
        cashflowExpenseBlocksText: blocksToText(DEFAULT_EXPENSE_BLOCKS)
    })

    useEffect(() => {
        let ignore = false
        const load = async () => {
            setLoading(true)
            setError(null)
            try {
                const res = await fetch('/api/settings', { cache: 'no-store' })
                if (!res.ok) throw new Error('Не удалось загрузить настройки')
                const data = await res.json()
                if (ignore) return
                const incomeCategories = Array.isArray(data.cashflowIncomeCategories)
                    ? data.cashflowIncomeCategories
                    : DEFAULT_INCOME_CATEGORIES
                const expenseCategories = Array.isArray(data.cashflowExpenseCategories)
                    ? data.cashflowExpenseCategories
                    : DEFAULT_EXPENSE_CATEGORIES
                const expenseBlocks = Array.isArray(data.cashflowExpenseBlocks)
                    ? data.cashflowExpenseBlocks
                    : DEFAULT_EXPENSE_BLOCKS
                setForm({
                    cashflowIncomeCategoriesText: toLines(incomeCategories),
                    cashflowExpenseCategoriesText: toLines(expenseCategories),
                    cashflowExpenseBlocksText: blocksToText(expenseBlocks)
                })
            } catch (e) {
                if (!ignore) setError(e instanceof Error ? e.message : 'Ошибка загрузки')
            } finally {
                if (!ignore) setLoading(false)
            }
        }
        load()
        return () => {
            ignore = true
        }
    }, [])

    const save = async () => {
        setSaving(true)
        setError(null)
        setSuccess(false)
        try {
            const res = await fetch('/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cashflowIncomeCategories: parseLines(form.cashflowIncomeCategoriesText),
                    cashflowExpenseCategories: parseLines(form.cashflowExpenseCategoriesText),
                    cashflowExpenseBlocks: parseBlocksText(form.cashflowExpenseBlocksText)
                })
            })
            if (!res.ok) throw new Error('Не удалось сохранить настройки')
            setSuccess(true)
            setTimeout(() => setSuccess(false), 3000)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Ошибка сохранения')
        } finally {
            setSaving(false)
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Настройки</CardTitle>
                <CardDescription>Категории доходов/расходов и блоки для казначейства</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {loading ? (
                    <div className="text-sm text-gray-500">Загрузка...</div>
                ) : (
                    <>
                        {error && <div className="text-sm text-red-600">{error}</div>}
                        {success && <div className="text-sm text-green-600">Настройки сохранены</div>}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Категории доходов (по одной в строке)</Label>
                                <Textarea
                                    rows={8}
                                    value={form.cashflowIncomeCategoriesText}
                                    onChange={e => setForm(p => ({ ...p, cashflowIncomeCategoriesText: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Категории расходов (по одной в строке)</Label>
                                <Textarea
                                    rows={8}
                                    value={form.cashflowExpenseCategoriesText}
                                    onChange={e => setForm(p => ({ ...p, cashflowExpenseCategoriesText: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Блоки расходов (формат: Название: категория1, категория2)</Label>
                            <Textarea
                                rows={6}
                                value={form.cashflowExpenseBlocksText}
                                onChange={e => setForm(p => ({ ...p, cashflowExpenseBlocksText: e.target.value }))}
                            />
                            <div className="text-xs text-muted-foreground">
                                Блоки используются для группировки структуры расходов. Категории должны совпадать со списком расходов.
                            </div>
                        </div>

                        <Button onClick={() => save()} disabled={saving}>
                            {saving ? 'Сохранение...' : 'Сохранить настройки'}
                        </Button>
                    </>
                )}
            </CardContent>
        </Card>
    )
}

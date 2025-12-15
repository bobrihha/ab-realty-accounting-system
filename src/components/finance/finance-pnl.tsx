'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Plus, TrendingUp, TrendingDown, DollarSign, Target, PieChart } from 'lucide-react'

interface FinancialData {
  month: string
  monthKey: string
  revenue: number
  expenses: {
    category: string
    amount: number
  }[]
  profit: number
  margin: number
}

interface ExpenseItem {
  id: string
  category: string
  amount: number
  date: string
  description: string | null
  month: string
}

const expenseCategories = [
  'Аренда',
  'Зарплата',
  'Маркетинг',
  'Роялти',
  'Налоги',
  'Коммунальные услуги',
  'Прочие расходы'
]

export function FinancePNL() {
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(String(currentYear))
  const [financialData, setFinancialData] = useState<FinancialData[]>([])
  const [expenses, setExpenses] = useState<ExpenseItem[]>([])
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const [newExpense, setNewExpense] = useState({
    category: '',
    amount: '',
    date: '',
    description: '',
    month: ''
  })

  useEffect(() => {
    const loadFinancialData = async () => {
      setLoading(true)
      const [pnlRes, expRes] = await Promise.all([
        fetch(`/api/finance?year=${encodeURIComponent(selectedYear)}`, { cache: 'no-store' }),
        fetch(`/api/expenses?year=${encodeURIComponent(selectedYear)}`, { cache: 'no-store' })
      ])
      if (!pnlRes.ok) throw new Error('Failed to load P&L')
      if (!expRes.ok) throw new Error('Failed to load expenses')
      const [pnlData, expData] = await Promise.all([pnlRes.json(), expRes.json()])
      setFinancialData(pnlData)
      setExpenses(expData)
      setLoading(false)
    }

    loadFinancialData().catch(err => {
      console.error(err)
      setLoading(false)
    })
  }, [selectedYear])

  const handleAddExpense = async () => {
    const res = await fetch('/api/finance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: newExpense.category,
        amount: parseFloat(newExpense.amount) || 0,
        date: newExpense.date,
        description: newExpense.description || undefined
      })
    })
    if (!res.ok) throw new Error('Failed to add expense')
    setIsAddExpenseOpen(false)
    setNewExpense({
      category: '',
      amount: '',
      date: '',
      description: '',
      month: ''
    })
    // reload
    const [pnlRes, expRes] = await Promise.all([
      fetch(`/api/finance?year=${encodeURIComponent(selectedYear)}`, { cache: 'no-store' }),
      fetch(`/api/expenses?year=${encodeURIComponent(selectedYear)}`, { cache: 'no-store' })
    ])
    setFinancialData(await pnlRes.json())
    setExpenses(await expRes.json())
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`
  }

  const getProfitColor = (margin: number) => {
    if (margin >= 50) return 'text-green-600'
    if (margin >= 30) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getProfitIcon = (margin: number) => {
    if (margin >= 50) return <TrendingUp className="h-4 w-4" />
    return <TrendingDown className="h-4 w-4" />
  }

  const totalRevenue = financialData.reduce((sum, data) => sum + data.revenue, 0)
  const totalExpenses = financialData.reduce((sum, data) => 
    sum + data.expenses.reduce((expSum, exp) => expSum + exp.amount, 0), 0
  )
  const totalProfit = totalRevenue - totalExpenses
  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0


  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Загрузка финансовых данных...</p>
        </div>
      </div>
    )
  }

  const yearOptions = Array.from({ length: 7 }, (_, i) => String(currentYear + 1 - i))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Финансы / P&L</h2>
          <p className="text-gray-500">Отчет о прибылях и убытках</p>
        </div>
        <div className="flex items-center space-x-4">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={isAddExpenseOpen} onOpenChange={setIsAddExpenseOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Добавить расход
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Добавление расхода</DialogTitle>
                <DialogDescription>
                  Введите информацию о новом расходе
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4 py-4">
                <div>
                  <Label htmlFor="category">Категория</Label>
                  <Select value={newExpense.category} onValueChange={(value) => setNewExpense(prev => ({ ...prev, category: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите категорию" />
                    </SelectTrigger>
                    <SelectContent>
                      {expenseCategories.map(category => (
                        <SelectItem key={category} value={category}>{category}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="amount">Сумма</Label>
                  <Input
                    id="amount"
                    type="number"
                    value={newExpense.amount}
                    onChange={(e) => setNewExpense(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="date">Дата</Label>
                  <Input
                    id="date"
                    type="date"
                    value={newExpense.date}
                    onChange={(e) => setNewExpense(prev => ({ ...prev, date: e.target.value }))}
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="description">Описание</Label>
                  <Input
                    id="description"
                    value={newExpense.description}
                    onChange={(e) => setNewExpense(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Описание расхода"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsAddExpenseOpen(false)}>
                  Отмена
                </Button>
                <Button onClick={handleAddExpense}>
                  Добавить
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Общая выручка
            </CardTitle>
            <DollarSign className="h-6 w-6 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
            <p className="text-xs text-gray-500 mt-2">За выбранный период</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Общие расходы
            </CardTitle>
            <TrendingDown className="h-6 w-6 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalExpenses)}</div>
            <p className="text-xs text-gray-500 mt-2">За выбранный период</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Чистая прибыль
            </CardTitle>
            <Target className="h-6 w-6 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalProfit)}</div>
            <p className="text-xs text-gray-500 mt-2">За выбранный период</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Средняя маржинальность
            </CardTitle>
            <PieChart className="h-6 w-6 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{formatPercent(avgMargin)}</div>
            <p className="text-xs text-gray-500 mt-2">За выбранный период</p>
          </CardContent>
        </Card>
      </div>

      {/* P&L Table */}
      <Card>
        <CardHeader>
          <CardTitle>Отчет P&L по месяцам</CardTitle>
          <CardDescription>
            Детализация доходов и расходов по месяцам
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Месяц</TableHead>
                  <TableHead className="text-right">Выручка</TableHead>
                  <TableHead className="text-right">Расходы</TableHead>
                  <TableHead className="text-right">Прибыль</TableHead>
                  <TableHead className="text-right">Маржа</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {financialData.map((data) => {
                  const totalExpenses = data.expenses.reduce((sum, exp) => sum + exp.amount, 0)
                  return (
                    <TableRow key={data.month}>
                      <TableCell className="font-medium">{data.month}</TableCell>
                      <TableCell className="text-right">{formatCurrency(data.revenue)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(totalExpenses)}</TableCell>
                      <TableCell className={`text-right font-medium ${getProfitColor(data.margin)}`}>
                        {formatCurrency(data.profit)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-1">
                          {getProfitIcon(data.margin)}
                          <span className={getProfitColor(data.margin)}>
                            {formatPercent(data.margin)}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Expense Categories Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Структура расходов</CardTitle>
          <CardDescription>
            Анализ расходов по категориям
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {expenseCategories.map(category => {
              const categoryTotal = financialData.reduce((sum, data) => {
                const expense = data.expenses.find(e => e.category === category)
                return sum + (expense ? expense.amount : 0)
              }, 0)
              
              const percentage = totalExpenses > 0 ? (categoryTotal / totalExpenses) * 100 : 0
              
              return (
                <div key={category} className="p-4 border rounded-lg">
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium">{category}</h4>
                    <Badge variant="secondary">{formatPercent(percentage)}</Badge>
                  </div>
                  <p className="text-2xl font-bold mt-2">{formatCurrency(categoryTotal)}</p>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

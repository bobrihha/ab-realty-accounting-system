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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

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

type FinanceMetricsMonth = {
  month: string
  monthKey: string
  bookingRevenue: number
  dealRevenue: number
  soldPrice: number
  netProfit: number
  agentCommission: number
  ropCommission: number
  agentPct: number
  ropPct: number
  sumPct: number
  margin: number
}

type FinanceMetricsRow = {
  employeeId: string
  name: string
  bookingRevenue: number
  dealRevenue: number
  soldPrice: number
  netProfit: number
  commission: number
  ratePct: number
}

type FinanceMetricsMonthEmployee = {
  month: string
  monthKey: string
  bookingRevenue: number
  dealRevenue: number
  soldPrice: number
  netProfit: number
  commission: number
  ratePct: number
  margin: number
}

type FinanceMetrics = {
  year: number
  months: FinanceMetricsMonth[]
  totals: {
    bookingRevenue: number
    dealRevenue: number
    soldPrice: number
    netProfit: number
    agentCommission: number
    ropCommission: number
    margin: number
  }
  byAgent: FinanceMetricsRow[]
  byRop: FinanceMetricsRow[]
  byAgentMonthly: { employeeId: string; name: string; months: FinanceMetricsMonthEmployee[] }[]
  byRopMonthly: { employeeId: string; name: string; months: FinanceMetricsMonthEmployee[] }[]
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
  const [metrics, setMetrics] = useState<FinanceMetrics | null>(null)
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [agentMonthlyId, setAgentMonthlyId] = useState<string>('')
  const [ropMonthlyId, setRopMonthlyId] = useState<string>('')

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
      const [metricsRes, pnlRes, expRes] = await Promise.all([
        fetch(`/api/finance/metrics?year=${encodeURIComponent(selectedYear)}`, { cache: 'no-store' }),
        fetch(`/api/finance?year=${encodeURIComponent(selectedYear)}`, { cache: 'no-store' }),
        fetch(`/api/expenses?year=${encodeURIComponent(selectedYear)}`, { cache: 'no-store' })
      ])
      if (!metricsRes.ok) throw new Error('Failed to load finance metrics')
      if (!pnlRes.ok) throw new Error('Failed to load P&L')
      if (!expRes.ok) throw new Error('Failed to load expenses')
      const [metricsData, pnlData, expData] = await Promise.all([metricsRes.json(), pnlRes.json(), expRes.json()])
      setMetrics(metricsData)
      setFinancialData(pnlData)
      setExpenses(expData)
      setAgentMonthlyId(prev => prev || metricsData?.byAgentMonthly?.[0]?.employeeId || '')
      setRopMonthlyId(prev => prev || metricsData?.byRopMonthly?.[0]?.employeeId || '')
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
    const [metricsRes, pnlRes, expRes] = await Promise.all([
      fetch(`/api/finance/metrics?year=${encodeURIComponent(selectedYear)}`, { cache: 'no-store' }),
      fetch(`/api/finance?year=${encodeURIComponent(selectedYear)}`, { cache: 'no-store' }),
      fetch(`/api/expenses?year=${encodeURIComponent(selectedYear)}`, { cache: 'no-store' })
    ])
    const metricsData = await metricsRes.json()
    setMetrics(metricsData)
    setFinancialData(await pnlRes.json())
    setExpenses(await expRes.json())
    setAgentMonthlyId(prev => prev || metricsData?.byAgentMonthly?.[0]?.employeeId || '')
    setRopMonthlyId(prev => prev || metricsData?.byRopMonthly?.[0]?.employeeId || '')
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

  const metricsTotals = metrics?.totals
  const agentMonthly = metrics?.byAgentMonthly?.find(a => a.employeeId === agentMonthlyId) ?? null
  const ropMonthly = metrics?.byRopMonthly?.find(r => r.employeeId === ropMonthlyId) ?? null


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

      <Tabs defaultValue="metrics" className="space-y-6">
        <TabsList className="flex w-full flex-wrap">
          <TabsTrigger value="metrics">Показатели</TabsTrigger>
          <TabsTrigger value="pnl">P&L</TabsTrigger>
          <TabsTrigger value="expenses">Расходы (ввод)</TabsTrigger>
        </TabsList>

        <TabsContent value="metrics">
          {/* Метрики из ТЗ (автоматические показатели) */}
          <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Выручка по броням</CardTitle>
              <DollarSign className="h-6 w-6 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(metricsTotals?.bookingRevenue ?? 0)}</div>
              <p className="text-xs text-gray-500 mt-2">По дате задатка</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Выручка по сделкам</CardTitle>
              <DollarSign className="h-6 w-6 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(metricsTotals?.dealRevenue ?? 0)}</div>
              <p className="text-xs text-gray-500 mt-2">Закрытые (по дате сделки)</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Чистая прибыль (сделки)</CardTitle>
              <Target className="h-6 w-6 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(metricsTotals?.netProfit ?? 0)}</div>
              <p className="text-xs text-gray-500 mt-2">По закрытым сделкам</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Рентабельность (сделки)</CardTitle>
              <PieChart className="h-6 w-6 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getProfitColor(metricsTotals?.margin ?? 0)}`}>{formatPercent(metricsTotals?.margin ?? 0)}</div>
              <p className="text-xs text-gray-500 mt-2">(прибыль × 100%) / выручка</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Показатели по месяцам</CardTitle>
            <CardDescription>
              Автоматические показатели из сделок: бронь/сделки, прибыль, проценты агента и РОПа
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Месяц</TableHead>
                    <TableHead className="text-right">Выручка (бронь)</TableHead>
                    <TableHead className="text-right">Выручка (сделки)</TableHead>
                    <TableHead className="text-right">Стоимость объектов</TableHead>
                    <TableHead className="text-right">Чистая прибыль</TableHead>
                    <TableHead className="text-right">% агент</TableHead>
                    <TableHead className="text-right">% РОП</TableHead>
                    <TableHead className="text-right">% суммарно</TableHead>
                    <TableHead className="text-right">Рентаб.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics?.months?.length ? (
                    metrics.months.map(m => (
                      <TableRow key={m.monthKey}>
                        <TableCell className="font-medium">{m.month}</TableCell>
                        <TableCell className="text-right">{formatCurrency(m.bookingRevenue)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(m.dealRevenue)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(m.soldPrice)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(m.netProfit)}</TableCell>
                        <TableCell className="text-right">{formatPercent(m.agentPct)}</TableCell>
                        <TableCell className="text-right">{formatPercent(m.ropPct)}</TableCell>
                        <TableCell className="text-right">{formatPercent(m.sumPct)}</TableCell>
                        <TableCell className="text-right">{formatPercent(m.margin)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                        Нет данных за выбранный год
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>По агентам (год)</CardTitle>
              <CardDescription>Выручка и комиссия агента по закрытым сделкам</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Агент</TableHead>
                      <TableHead className="text-right">Выручка (бронь)</TableHead>
                      <TableHead className="text-right">Выручка (сделки)</TableHead>
                      <TableHead className="text-right">Комиссия</TableHead>
                      <TableHead className="text-right">% комисс.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics?.byAgent?.length ? (
                      metrics.byAgent.map(a => (
                        <TableRow key={a.employeeId}>
                          <TableCell className="font-medium">{a.name}</TableCell>
                          <TableCell className="text-right">{formatCurrency(a.bookingRevenue)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(a.dealRevenue)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(a.commission)}</TableCell>
                          <TableCell className="text-right">{formatPercent(a.ratePct)}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                          Нет данных
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>По РОПам (год)</CardTitle>
              <CardDescription>Выручка и комиссия РОПа по закрытым сделкам</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>РОП</TableHead>
                      <TableHead className="text-right">Выручка (бронь)</TableHead>
                      <TableHead className="text-right">Выручка (сделки)</TableHead>
                      <TableHead className="text-right">Комиссия</TableHead>
                      <TableHead className="text-right">% комисс.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics?.byRop?.length ? (
                      metrics.byRop.map(r => (
                        <TableRow key={r.employeeId}>
                          <TableCell className="font-medium">{r.name}</TableCell>
                          <TableCell className="text-right">{formatCurrency(r.bookingRevenue)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(r.dealRevenue)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(r.commission)}</TableCell>
                          <TableCell className="text-right">{formatPercent(r.ratePct)}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                          Нет данных
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="space-y-2">
              <div>
                <CardTitle>Агент помесячно</CardTitle>
                <CardDescription>Выручка (бронь/сделки), комиссия, прибыль и % за выбранный год</CardDescription>
              </div>
              <Select value={agentMonthlyId} onValueChange={setAgentMonthlyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите агента" />
                </SelectTrigger>
                <SelectContent>
                  {(metrics?.byAgentMonthly ?? []).map(a => (
                    <SelectItem key={a.employeeId} value={a.employeeId}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Месяц</TableHead>
                      <TableHead className="text-right">Выручка (бронь)</TableHead>
                      <TableHead className="text-right">Выручка (сделки)</TableHead>
                      <TableHead className="text-right">Комиссия</TableHead>
                      <TableHead className="text-right">% комисс.</TableHead>
                      <TableHead className="text-right">Рентаб.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agentMonthly?.months?.length ? (
                      agentMonthly.months.map(m => (
                        <TableRow key={m.monthKey}>
                          <TableCell className="font-medium">{m.month}</TableCell>
                          <TableCell className="text-right">{formatCurrency(m.bookingRevenue)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(m.dealRevenue)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(m.commission)}</TableCell>
                          <TableCell className="text-right">{formatPercent(m.ratePct)}</TableCell>
                          <TableCell className="text-right">{formatPercent(m.margin)}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                          Нет данных
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-2">
              <div>
                <CardTitle>РОП помесячно</CardTitle>
                <CardDescription>Выручка (бронь/сделки), комиссия, прибыль и % за выбранный год</CardDescription>
              </div>
              <Select value={ropMonthlyId} onValueChange={setRopMonthlyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите РОПа" />
                </SelectTrigger>
                <SelectContent>
                  {(metrics?.byRopMonthly ?? []).map(r => (
                    <SelectItem key={r.employeeId} value={r.employeeId}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Месяц</TableHead>
                      <TableHead className="text-right">Выручка (бронь)</TableHead>
                      <TableHead className="text-right">Выручка (сделки)</TableHead>
                      <TableHead className="text-right">Комиссия</TableHead>
                      <TableHead className="text-right">% комисс.</TableHead>
                      <TableHead className="text-right">Рентаб.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ropMonthly?.months?.length ? (
                      ropMonthly.months.map(m => (
                        <TableRow key={m.monthKey}>
                          <TableCell className="font-medium">{m.month}</TableCell>
                          <TableCell className="text-right">{formatCurrency(m.bookingRevenue)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(m.dealRevenue)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(m.commission)}</TableCell>
                          <TableCell className="text-right">{formatPercent(m.ratePct)}</TableCell>
                          <TableCell className="text-right">{formatPercent(m.margin)}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                          Нет данных
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

        </TabsContent>

        <TabsContent value="pnl">
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
              <CardDescription>Детализация доходов и расходов по месяцам</CardDescription>
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
              <CardDescription>Анализ расходов по категориям</CardDescription>
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
        </TabsContent>

        <TabsContent value="expenses">
          <Card>
            <CardHeader>
              <CardTitle>Расходы (ручной ввод)</CardTitle>
              <CardDescription>Эти записи попадают в P&L как расходы периода</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Дата</TableHead>
                      <TableHead>Категория</TableHead>
                      <TableHead className="text-right">Сумма</TableHead>
                      <TableHead>Комментарий</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                          Расходов нет
                        </TableCell>
                      </TableRow>
                    ) : (
                      expenses.map(e => (
                        <TableRow key={e.id}>
                          <TableCell>{new Date(e.date).toLocaleDateString('ru-RU')}</TableCell>
                          <TableCell className="font-medium">{e.category}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(e.amount)}</TableCell>
                          <TableCell className="text-gray-600">{e.description ?? '-'}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TrendingUp, TrendingDown, DollarSign, Target, PieChart, FileDown, FileText } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MetricHelp } from '@/components/help/metric-help'
import { exportToExcel } from '@/lib/export-utils'

interface FinancialData {
  month: string
  monthKey: string
  revenue: number
  expenses: {
    category: string
    amount: number
  }[]
  totalExpenses: number
  netProfitFromDeals: number
  profit: number
  margin: number
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

type LegalServicesMonth = {
  month: string
  monthKey: string
  dealsCount: number
  amount: number
}

type LegalServicesMetrics = {
  months: LegalServicesMonth[]
  totals: { dealsCount: number; amount: number }
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
  legalServices: LegalServicesMetrics
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
  const [metrics, setMetrics] = useState<FinanceMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [agentMonthlyId, setAgentMonthlyId] = useState<string>('')
  const [ropMonthlyId, setRopMonthlyId] = useState<string>('')
  const [legalMonthFilter, setLegalMonthFilter] = useState<string>('all')

  useEffect(() => {
    const loadFinancialData = async () => {
      setLoading(true)
      const [metricsRes, pnlRes] = await Promise.all([
        fetch(`/api/finance/metrics?year=${encodeURIComponent(selectedYear)}`, { cache: 'no-store' }),
        fetch(`/api/finance?year=${encodeURIComponent(selectedYear)}`, { cache: 'no-store' })
      ])
      if (!metricsRes.ok) throw new Error('Failed to load finance metrics')
      if (!pnlRes.ok) throw new Error('Failed to load P&L')
      const [metricsData, pnlData] = await Promise.all([metricsRes.json(), pnlRes.json()])
      setMetrics(metricsData)
      setFinancialData(pnlData)
      setAgentMonthlyId(prev => prev || metricsData?.byAgentMonthly?.[0]?.employeeId || '')
      setRopMonthlyId(prev => prev || metricsData?.byRopMonthly?.[0]?.employeeId || '')
      setLoading(false)
    }

    loadFinancialData().catch(err => {
      console.error(err)
      setLoading(false)
    })
  }, [selectedYear])

  useEffect(() => {
    setLegalMonthFilter('all')
  }, [selectedYear])

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

  const handleExportExcel = () => {
    if (!metrics) return

    const sheets = [
      {
        name: 'Показатели',
        data: metrics.months.map(m => ({
          'Месяц': m.month,
          'Выручка (бронь)': m.bookingRevenue,
          'Выручка (сделки)': m.dealRevenue,
          'Стоимость объектов': m.soldPrice,
          'Доход': m.netProfit,
          'Комиссия агента': m.agentCommission,
          'Комиссия РОПа': m.ropCommission,
          '% Агента': m.agentPct,
          '% РОПа': m.ropPct,
          'Рентабельность': m.margin
        }))
      },
      {
        name: 'P&L',
        data: financialData.map(d => ({
          'Месяц': d.month,
          'Выручка': d.revenue,
          'Расходы': d.expenses.reduce((s, e) => s + e.amount, 0),
          'Прибыль': d.profit,
          'Рентабельность': d.margin
        }))
      },
      {
        name: 'Агенты',
        data: metrics.byAgent.map(a => ({
          'Имя': a.name,
          'Выручка (бронь)': a.bookingRevenue,
          'Выручка (сделки)': a.dealRevenue,
          'Комиссия': a.commission,
          'Ставка %': a.ratePct
        }))
      },
      {
        name: 'РОПы',
        data: metrics.byRop.map(r => ({
          'Имя': r.name,
          'Выручка (бронь)': r.bookingRevenue,
          'Выручка (сделки)': r.dealRevenue,
          'Комиссия': r.commission,
          'Ставка %': r.ratePct
        }))
      }
    ]

    if (metrics.legalServices) {
      sheets.push({
        name: 'Юр. услуги',
        data: metrics.legalServices.months.map(m => ({
          'Месяц': m.month,
          'Сделок': m.dealsCount,
          'Сумма': m.amount
        }))
      } as any)
    }

    exportToExcel(`finance_report_${selectedYear}`, sheets)
  }



  const totalRevenue = financialData.reduce((sum, data) => sum + data.revenue, 0)
  const totalIncome = financialData.reduce((sum, data) => sum + (data.netProfitFromDeals ?? 0), 0)
  const totalExpenses = financialData.reduce((sum, data) => sum + (data.totalExpenses ?? 0), 0)
  const totalProfit = totalIncome - totalExpenses
  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0

  const metricsTotals = metrics?.totals
  const agentMonthly = metrics?.byAgentMonthly?.find(a => a.employeeId === agentMonthlyId) ?? null
  const ropMonthly = metrics?.byRopMonthly?.find(r => r.employeeId === ropMonthlyId) ?? null
  const legalMonths = metrics?.legalServices?.months ?? []
  const legalTotals = metrics?.legalServices?.totals
  const legalFilteredMonths =
    legalMonthFilter === 'all' ? legalMonths : legalMonths.filter(m => m.monthKey === legalMonthFilter)
  const legalSummary =
    legalMonthFilter === 'all' ? legalTotals : legalMonths.find(m => m.monthKey === legalMonthFilter)


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
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={handleExportExcel}>
            <FileText className="h-4 w-4 mr-2" />
            Excel
          </Button>

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
        </div>
      </div>

      <Tabs defaultValue="metrics" className="space-y-6">
        <TabsList className="flex w-full flex-wrap">
          <TabsTrigger value="metrics">Показатели</TabsTrigger>
          <TabsTrigger value="pnl">P&L</TabsTrigger>
        </TabsList>

        <TabsContent value="metrics">
          {/* Метрики из ТЗ (автоматические показатели) */}
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Выручка по броням</CardTitle>
                  <MetricHelp
                    title="Выручка по броням"
                    description="Как считается показатель"
                    trigger={<DollarSign className="h-6 w-6 text-orange-600" />}
                    summary="Сколько комиссионных “пришло в работу” по дате задатка."
                    details={
                      <div className="space-y-2">
                        <div className="font-medium">Как считается</div>
                        <div className="text-muted-foreground">Берем все сделки, где был задаток в выбранном году (кроме отмененных).</div>
                        <div className="text-muted-foreground">Складываем комиссию агентства по этим сделкам и раскладываем по месяцам по дате задатка.</div>
                      </div>
                    }
                  />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(metricsTotals?.bookingRevenue ?? 0)}</div>
                  <p className="text-xs text-gray-500 mt-2">По дате задатка</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Выручка по сделкам</CardTitle>
                  <MetricHelp
                    title="Выручка по сделкам"
                    description="Как считается показатель"
                    trigger={<DollarSign className="h-6 w-6 text-blue-600" />}
                    summary="Сколько комиссионных заработали по сделкам с датой сделки."
                    details={
                      <div className="space-y-2">
                        <div className="font-medium">Как считается</div>
                        <div className="text-muted-foreground">Берем сделки с датой сделки в выбранном году.</div>
                        <div className="text-muted-foreground">Складываем комиссию агентства и относим к месяцу по дате сделки.</div>
                      </div>
                    }
                  />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(metricsTotals?.dealRevenue ?? 0)}</div>
                  <p className="text-xs text-gray-500 mt-2">По дате сделки</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Доход (сделки)</CardTitle>
                  <MetricHelp
                    title="Доход (сделки)"
                    description="Как считается показатель"
                    trigger={<Target className="h-6 w-6 text-green-600" />}
                    summary="Сколько дохода принесли сделки с датой сделки (после налогов, выплат и расходов по сделке)."
                    details={
                      <div className="space-y-2">
                        <div className="font-medium">Как считается</div>
                        <div className="text-muted-foreground">Берем сделки с датой сделки в выбранном году.</div>
                        <div className="text-muted-foreground">
                          Для каждой сделки прибыль = комиссия агентства − налог (со всей суммы) − рекомендация − выплаты (агенту/РОПу от комиссии минус рекомендация) − юрист − прочие расходы.
                        </div>
                        <div className="text-muted-foreground">Складываем прибыль всех таких сделок по месяцам (по дате сделки).</div>
                      </div>
                    }
                  />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(metricsTotals?.netProfit ?? 0)}</div>
                  <p className="text-xs text-gray-500 mt-2">По сделкам с датой сделки</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Рентабельность (сделки)</CardTitle>
                  <MetricHelp
                    title="Рентабельность (сделки)"
                    description="Как считается показатель"
                    trigger={<PieChart className="h-6 w-6 text-purple-600" />}
                    summary="Показывает долю прибыли в выручке по сделкам с датой сделки."
                    details={
                      <div className="space-y-2">
                        <div className="font-medium">Как считается</div>
                        <div className="text-muted-foreground">Рентабельность = (прибыль по сделкам с датой сделки × 100%) / выручка по сделкам с датой сделки.</div>
                        <div className="text-muted-foreground">Если выручка равна нулю — рентабельность будет 0%.</div>
                      </div>
                    }
                  />
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
                        <TableHead className="text-right">Доход</TableHead>
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

            <Card>
              <CardHeader className="space-y-2">
                <div>
                  <CardTitle>Юридические услуги</CardTitle>
                  <CardDescription>Отдельный доход по юр. сопровождению (не включается в прибыль)</CardDescription>
                </div>
                <Select value={legalMonthFilter} onValueChange={setLegalMonthFilter}>
                  <SelectTrigger className="w-[240px]">
                    <SelectValue placeholder="Месяц" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все месяцы</SelectItem>
                    {legalMonths.map(m => (
                      <SelectItem key={m.monthKey} value={m.monthKey}>
                        {m.month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-gray-500">Сделок с юр. сопровождением</div>
                    <div className="text-2xl font-bold">{legalSummary?.dealsCount ?? 0}</div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-gray-500">Сумма юр. услуг</div>
                    <div className="text-2xl font-bold">{formatCurrency(legalSummary?.amount ?? 0)}</div>
                  </div>
                </div>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Месяц</TableHead>
                        <TableHead className="text-right">Сделок</TableHead>
                        <TableHead className="text-right">Сумма</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {legalFilteredMonths.length ? (
                        legalFilteredMonths.map(m => (
                          <TableRow key={m.monthKey}>
                            <TableCell className="font-medium">{m.month}</TableCell>
                            <TableCell className="text-right">{m.dealsCount}</TableCell>
                            <TableCell className="text-right">{formatCurrency(m.amount)}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-8 text-gray-500">
                            Нет данных
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
                  <CardDescription>Выручка и комиссия агента по сделкам с датой сделки</CardDescription>
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
                  <CardDescription>Выручка и комиссия РОПа по сделкам с датой сделки</CardDescription>
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
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Выручка
                </CardTitle>
                <DollarSign className="h-5 w-5 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">{formatCurrency(totalRevenue)}</div>
                <p className="text-xs text-gray-500 mt-1">По сделкам</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Доход
                </CardTitle>
                <Target className="h-5 w-5 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-green-600">{formatCurrency(totalIncome)}</div>
                <p className="text-xs text-gray-500 mt-1">После выплат и налогов</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Расходы
                </CardTitle>
                <TrendingDown className="h-5 w-5 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">{formatCurrency(totalExpenses)}</div>
                <p className="text-xs text-gray-500 mt-1">Из казначейства</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Прибыль
                </CardTitle>
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className={`text-xl font-bold ${totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(totalProfit)}</div>
                <p className="text-xs text-gray-500 mt-1">Доход − Расходы</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Маржа
                </CardTitle>
                <PieChart className="h-5 w-5 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-purple-600">{formatPercent(avgMargin)}</div>
                <p className="text-xs text-gray-500 mt-1">(Прибыль / Выручка) × 100%</p>
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
                      <TableHead className="text-right">Доход</TableHead>
                      <TableHead className="text-right">Расходы</TableHead>
                      <TableHead className="text-right">Прибыль</TableHead>
                      <TableHead className="text-right">Маржа</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {financialData.map((data) => {
                      const income = data.netProfitFromDeals ?? 0
                      const expenses = data.totalExpenses ?? 0
                      const profit = income - expenses
                      const margin = data.revenue > 0 ? (profit / data.revenue) * 100 : 0
                      return (
                        <TableRow key={data.month}>
                          <TableCell className="font-medium">{data.month}</TableCell>
                          <TableCell className="text-right">{formatCurrency(data.revenue)}</TableCell>
                          <TableCell className="text-right text-green-600">{formatCurrency(income)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(expenses)}</TableCell>
                          <TableCell className={`text-right font-medium ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {formatCurrency(profit)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end space-x-1">
                              {getProfitIcon(margin)}
                              <span className={getProfitColor(margin)}>
                                {formatPercent(margin)}
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
      </Tabs>
    </div>
  )
}

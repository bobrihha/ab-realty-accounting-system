'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RefreshCw, Calendar, DollarSign, TrendingUp, Wallet, Users } from 'lucide-react'

type PayrollType = 'AGENT' | 'ROP'

type PayrollPayment = {
  id: string
  amount: number
  paidAt: string
  account: { id: string; name: string }
}

type PayrollAccrual = {
  id: string
  type: PayrollType
  amount: number
  accruedAt: string
  paid: number
  remaining: number
  derivedStatus: 'unpaid' | 'partially' | 'paid'
  employee: { id: string; name: string; role: string }
  deal: { id: string; client: string; object: string; depositDate: string; dealDate: string | null; status: string }
  payments: PayrollPayment[]
}

type AgentStats = {
  role: 'AGENT' | 'ROP'
  filters: { year: number; month: number | null; quarter: number | null }
  kpi: {
    depositsInPeriod: { myCommission: number; grossCommission: number; count: number }
    closedInPeriod: { myCommission: number; grossCommission: number; count: number }
    inDepositsNow: { myCommission: number; grossCommission: number; count: number }
    pending: { myCommission: number; grossCommission: number; count: number }
    averageSalary: number
    monthsInPeriod: number
  }
}

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']

export function Compensation() {
  const [loading, setLoading] = useState(true)
  const [accruals, setAccruals] = useState<PayrollAccrual[]>([])
  const [stats, setStats] = useState<AgentStats | null>(null)

  const currentYear = new Date().getFullYear()
  const [yearFilter, setYearFilter] = useState(String(currentYear))
  const [monthFilter, setMonthFilter] = useState<string>('all')
  const [quarterFilter, setQuarterFilter] = useState<string>('all')

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(n)

  const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString('ru-RU') : '-')

  const load = useCallback(async () => {
    setLoading(true)

    // Загружаем данные о начислениях агента
    const payrollRes = await fetch('/api/payroll?status=all', { cache: 'no-store' })
    if (payrollRes.ok) {
      const payroll = await payrollRes.json()
      setAccruals(payroll.accruals ?? [])
    }

    // Загружаем KPI статистику
    const params = new URLSearchParams({ year: yearFilter })
    if (monthFilter !== 'all') params.set('month', monthFilter)
    if (quarterFilter !== 'all') params.set('quarter', quarterFilter)

    const statsRes = await fetch(`/api/agent/stats?${params.toString()}`, { cache: 'no-store' })
    if (statsRes.ok) {
      const statsData = await statsRes.json()
      setStats(statsData)
    }

    setLoading(false)
  }, [yearFilter, monthFilter, quarterFilter])

  useEffect(() => {
    load().catch(err => {
      console.error(err)
      setLoading(false)
    })
  }, [load])

  // Фильтрация начислений по периоду
  const filteredAccruals = useMemo(() => {
    return accruals.filter(a => {
      const date = new Date(a.deal.dealDate || a.accruedAt)
      const year = date.getFullYear()
      const month = date.getMonth() + 1
      const quarter = Math.ceil(month / 3)

      if (yearFilter !== 'all' && year !== Number(yearFilter)) return false
      if (monthFilter !== 'all' && month !== Number(monthFilter)) return false
      if (quarterFilter !== 'all' && quarter !== Number(quarterFilter)) return false

      return true
    })
  }, [accruals, yearFilter, monthFilter, quarterFilter])

  // Все невыплаченные
  const unpaidAccruals = useMemo(() => accruals.filter(a => a.remaining > 0), [accruals])

  // Итоги
  const totals = useMemo(() => {
    const totalAccrued = filteredAccruals.reduce((s, a) => s + a.amount, 0)
    const totalPaid = filteredAccruals.reduce((s, a) => s + a.paid, 0)
    const totalRemaining = unpaidAccruals.reduce((s, a) => s + a.remaining, 0)
    return { totalAccrued, totalPaid, totalRemaining }
  }, [filteredAccruals, unpaidAccruals])

  const yearOptions = Array.from({ length: 5 }, (_, i) => String(currentYear - i))

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Загрузка...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Моя зарплата</h2>
          <p className="text-gray-500">Начисления и выплаты по сделкам</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <Button variant="outline" onClick={() => load().catch(err => alert(err.message))}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Обновить
          </Button>
        </div>
      </div>

      {/* Фильтры */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Период
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <Select value={yearFilter} onValueChange={v => { setYearFilter(v); setMonthFilter('all'); setQuarterFilter('all') }}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map(y => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={monthFilter} onValueChange={v => { setMonthFilter(v); setQuarterFilter('all') }}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Месяц" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Весь год</SelectItem>
              {MONTHS.map((m, i) => (
                <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={quarterFilter} onValueChange={v => { setQuarterFilter(v); setMonthFilter('all') }}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Квартал" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">—</SelectItem>
              <SelectItem value="1">Q1</SelectItem>
              <SelectItem value="2">Q2</SelectItem>
              <SelectItem value="3">Q3</SelectItem>
              <SelectItem value="4">Q4</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* KPI карточки */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-orange-800 flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Итого брони
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-900">
                {fmtMoney(stats.kpi.depositsInPeriod.myCommission)}
              </div>
              <p className="text-xs text-orange-600 mt-1">
                {stats.kpi.depositsInPeriod.count} сделок · вал {fmtMoney(stats.kpi.depositsInPeriod.grossCommission)}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-800 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Итого сделок
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-900">
                {fmtMoney(stats.kpi.closedInPeriod.myCommission)}
              </div>
              <p className="text-xs text-green-600 mt-1">
                {stats.kpi.closedInPeriod.count} сделок · вал {fmtMoney(stats.kpi.closedInPeriod.grossCommission)}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-yellow-800 flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                В задатках
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-900">
                {fmtMoney(stats.kpi.inDepositsNow.myCommission)}
              </div>
              <p className="text-xs text-yellow-600 mt-1">
                {stats.kpi.inDepositsNow.count} сделок
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-purple-800 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Ожидаю
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-900">
                {fmtMoney(stats.kpi.pending.myCommission)}
              </div>
              <p className="text-xs text-purple-600 mt-1">
                {stats.kpi.pending.count} сделок
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-teal-50 to-teal-100 border-teal-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-teal-800 flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Средняя ЗП/мес
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-teal-900">
                {fmtMoney(stats.kpi.averageSalary)}
              </div>
              <p className="text-xs text-teal-600 mt-1">
                за {stats.kpi.monthsInPeriod} мес
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Сводные карточки выплат */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-blue-800">Начислено</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900">{fmtMoney(totals.totalAccrued)}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-green-800">Выплачено</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900">{fmtMoney(totals.totalPaid)}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-orange-800">К выплате</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-900">{fmtMoney(totals.totalRemaining)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Вкладки */}
      <Tabs defaultValue="accrued" className="space-y-4">
        <TabsList className="flex w-full flex-wrap">
          <TabsTrigger value="accrued">Начислено</TabsTrigger>
          <TabsTrigger value="paid">Выплачено</TabsTrigger>
          <TabsTrigger value="remaining">К выплате</TabsTrigger>
        </TabsList>

        {/* Таб 1: Начислено */}
        <TabsContent value="accrued">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Начисления за период</CardTitle>
              <CardDescription>Все мои начисления по сделкам</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Сделка</TableHead>
                    <TableHead>Дата</TableHead>
                    <TableHead className="text-right">Начислено</TableHead>
                    <TableHead>Статус</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAccruals.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                        Нет начислений за период
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAccruals.map(a => (
                      <TableRow key={a.id}>
                        <TableCell>
                          <div className="font-medium">{a.deal.client}</div>
                          <div className="text-xs text-gray-500 max-w-[300px] truncate">{a.deal.object}</div>
                        </TableCell>
                        <TableCell>{fmtDate(a.deal.dealDate ?? a.accruedAt)}</TableCell>
                        <TableCell className="text-right font-medium">{fmtMoney(a.amount)}</TableCell>
                        <TableCell>
                          <Badge className={
                            a.derivedStatus === 'paid' ? 'bg-green-100 text-green-800' :
                              a.derivedStatus === 'partially' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                          }>
                            {a.derivedStatus === 'paid' ? 'Выплачено' : a.derivedStatus === 'partially' ? 'Частично' : 'К выплате'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                  <TableRow className="bg-gray-50 font-bold">
                    <TableCell colSpan={2}>Итого</TableCell>
                    <TableCell className="text-right">{fmtMoney(totals.totalAccrued)}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Таб 2: Выплачено */}
        <TabsContent value="paid">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Выплачено за период</CardTitle>
              <CardDescription>Фактические выплаты</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Сделка</TableHead>
                    <TableHead>Дата сделки</TableHead>
                    <TableHead className="text-right">Начислено</TableHead>
                    <TableHead className="text-right">Выплачено</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAccruals.filter(a => a.paid > 0).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                        Нет выплат за период
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAccruals.filter(a => a.paid > 0).map(a => (
                      <TableRow key={a.id}>
                        <TableCell>
                          <div className="font-medium">{a.deal.client}</div>
                          <div className="text-xs text-gray-500 max-w-[300px] truncate">{a.deal.object}</div>
                        </TableCell>
                        <TableCell>{fmtDate(a.deal.dealDate ?? a.accruedAt)}</TableCell>
                        <TableCell className="text-right">{fmtMoney(a.amount)}</TableCell>
                        <TableCell className="text-right font-medium text-green-700">{fmtMoney(a.paid)}</TableCell>
                      </TableRow>
                    ))
                  )}
                  <TableRow className="bg-gray-50 font-bold">
                    <TableCell colSpan={3}>Итого</TableCell>
                    <TableCell className="text-right text-green-700">{fmtMoney(totals.totalPaid)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Таб 3: К выплате */}
        <TabsContent value="remaining">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">К выплате</CardTitle>
              <CardDescription>Все невыплаченные начисления</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Сделка</TableHead>
                    <TableHead>Дата сделки</TableHead>
                    <TableHead className="text-right">Начислено</TableHead>
                    <TableHead className="text-right">Выплачено</TableHead>
                    <TableHead className="text-right">Остаток</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unpaidAccruals.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                        Всё выплачено! 🎉
                      </TableCell>
                    </TableRow>
                  ) : (
                    unpaidAccruals.map(a => (
                      <TableRow key={a.id}>
                        <TableCell>
                          <div className="font-medium">{a.deal.client}</div>
                          <div className="text-xs text-gray-500 max-w-[300px] truncate">{a.deal.object}</div>
                        </TableCell>
                        <TableCell>{fmtDate(a.deal.dealDate ?? a.accruedAt)}</TableCell>
                        <TableCell className="text-right">{fmtMoney(a.amount)}</TableCell>
                        <TableCell className="text-right text-green-700">{fmtMoney(a.paid)}</TableCell>
                        <TableCell className="text-right font-bold text-orange-700">{fmtMoney(a.remaining)}</TableCell>
                      </TableRow>
                    ))
                  )}
                  <TableRow className="bg-gray-50 font-bold">
                    <TableCell colSpan={4}>Итого к выплате</TableCell>
                    <TableCell className="text-right text-orange-700">{fmtMoney(totals.totalRemaining)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

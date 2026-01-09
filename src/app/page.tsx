'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { DealsRegistry } from '@/components/deals/deals-registry'
import { FinancePNL } from '@/components/finance/finance-pnl'
import { Treasury } from '@/components/treasury/treasury'
import { Team } from '@/components/team/team'
import { Compensation } from '@/components/compensation/compensation'
import { Payroll } from '@/components/payroll/payroll'
import { LegalServicesRegistry } from '@/components/legal-services/legal-services'
import { signOut } from 'next-auth/react'
import { useSession } from 'next-auth/react'
import { Badge } from '@/components/ui/badge'
import { DollarSign, FileText, TrendingUp, TrendingDown, Calendar, Users, Clock, Filter } from 'lucide-react'
import { MetricHelp } from '@/components/help/metric-help'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface KPICard {
  title: string
  value: string
  change?: number
  icon: React.ReactNode
  description: string
  color: string
}

export default function Dashboard() {
  const [kpiData, setKpiData] = useState<KPICard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { data: session } = useSession()
  const { status } = useSession()
  const router = useRouter()
  const role = ((session as any)?.role as string | undefined) ?? 'AGENT'
  const accountName = session?.user?.name ?? session?.user?.email ?? 'Пользователь'

  // Extended KPI state
  type Employee = { id: string; name: string }
  type ExtendedKPI = {
    revenueByDeposit: { value: number; count: number }
    revenueByDeal: { value: number; count: number }
    depositsRevenue: { value: number; count: number }
    pendingRevenue: { value: number; count: number }
    dealsPerAgent: { value: number; totalDeals: number; agentCount: number; monthsInPeriod: number }
  }
  const [employees, setEmployees] = useState<Employee[]>([])
  const [extendedKPI, setExtendedKPI] = useState<ExtendedKPI | null>(null)
  const [extFilter, setExtFilter] = useState({
    agentId: 'all',
    year: new Date().getFullYear().toString(),
    month: 'none',
    quarter: 'none'
  })

  const roleLabel = (r: string) => {
    switch (r) {
      case 'OWNER':
        return 'Владелец'
      case 'ACCOUNTANT':
        return 'Бухгалтер'
      case 'ROP':
        return 'РОП'
      case 'LAWYER':
        return 'Юрист'
      case 'AGENT':
      default:
        return 'Агент'
    }
  }

  useEffect(() => {
    const loadData = async () => {
      setError(null)
      const res = await fetch('/api/dashboard', { cache: 'no-store' })
      if (!res.ok) {
        if (res.status === 401) {
          router.replace('/auth/signin')
          return
        }
        throw new Error('Не удалось загрузить дашборд')
      }
      const data = await res.json().catch(() => {
        throw new Error('Некорректный ответ сервера')
      })

      const fmt = (n: number) =>
        new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(n)

      const kpis: KPICard[] = [
        {
          title: 'Ожидаю итого',
          value: fmt(data.kpis.expectedTotal ?? 0),
          icon: <DollarSign className="h-6 w-6" />,
          description: `Общая сумма в работе · ${data?.kpis?.counts?.expectedTotal ?? 0} сделок`,
          color: 'text-blue-600'
        },
        {
          title: 'В задатках',
          value: fmt(data.kpis.deposits ?? 0),
          icon: <FileText className="h-6 w-6" />,
          description: `Прогноз поступлений · ${data?.kpis?.counts?.deposits ?? 0} сделок`,
          color: 'text-orange-600'
        },
        {
          title: 'На оплате',
          value: fmt(data.kpis.onPayment ?? 0),
          icon: <TrendingUp className="h-6 w-6" />,
          description: `Дебиторская задолженность · ${data?.kpis?.counts?.onPayment ?? 0} сделок`,
          color: 'text-green-600'
        },
        {
          title: 'Ожидаемая прибыль',
          value: fmt(data.kpis.expectedProfit ?? 0),
          icon: <TrendingDown className="h-6 w-6" />,
          description: `Активные сделки · ${data?.kpis?.counts?.expectedProfit ?? 0} сделок`,
          color: 'text-purple-600'
        }
      ]

      setKpiData(kpis)
      setLoading(false)
    }

    if (status === 'unauthenticated') {
      router.replace('/auth/signin')
      return
    }
    if (status !== 'authenticated') return

    loadData().catch((e: unknown) => {
      setError(e instanceof Error ? e.message : 'Ошибка')
      setLoading(false)
    })
  }, [router, status])

  // Load employees list for filter
  useEffect(() => {
    if (status !== 'authenticated') return
    if (role !== 'OWNER' && role !== 'ACCOUNTANT' && role !== 'ROP') return
    fetch('/api/employees', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => setEmployees(data.map((e: any) => ({ id: e.id, name: e.name }))))
      .catch(() => { })
  }, [status, role])

  // Load extended KPI
  useEffect(() => {
    if (status !== 'authenticated') return
    const params = new URLSearchParams()
    if (extFilter.agentId !== 'all') params.set('agentId', extFilter.agentId)
    if (extFilter.year) params.set('year', extFilter.year)
    if (extFilter.month) params.set('month', extFilter.month)
    if (extFilter.quarter) params.set('quarter', extFilter.quarter)

    fetch(`/api/dashboard/extended?${params.toString()}`, { cache: 'no-store' })
      .then(res => res.json())
      .then(data => setExtendedKPI(data))
      .catch(() => { })
  }, [status, extFilter])

  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(n)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Загрузка данных...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Ошибка</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button onClick={() => location.reload()}>Обновить</Button>
            <Button variant="outline" onClick={() => signOut({ callbackUrl: '/auth/signin' })}>
              Выйти
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Система учета Агенства недвижимости АБ Риэлт Групп</h1>
              <p className="text-sm text-gray-500">Управленческий и финансовый учет</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="hidden sm:flex flex-col items-end leading-tight">
                <div className="text-sm font-medium text-gray-900 max-w-[260px] truncate">{accountName}</div>
                <Badge variant="secondary">{roleLabel(role)}</Badge>
              </div>
              <Button variant="outline" onClick={() => signOut({ callbackUrl: '/auth/signin' })}>
                Выйти
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Extended KPI with Filters */}
        {(role === 'OWNER' || role === 'ACCOUNTANT' || role === 'ROP') && (
          <Card className="mb-8">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Filter className="h-5 w-5" />
                    Расширенная аналитика
                  </CardTitle>
                  <CardDescription>Выручка с фильтрами по периоду и агенту</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  {employees.length > 0 && (
                    <Select value={extFilter.agentId} onValueChange={v => setExtFilter(f => ({ ...f, agentId: v }))}>
                      <SelectTrigger className="w-[180px]">
                        <Users className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Агент" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Все агенты</SelectItem>
                        {employees.map(e => (
                          <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Select value={extFilter.year} onValueChange={v => setExtFilter(f => ({ ...f, year: v }))}>
                    <SelectTrigger className="w-[100px]">
                      <SelectValue placeholder="Год" />
                    </SelectTrigger>
                    <SelectContent>
                      {[2023, 2024, 2025, 2026].map(y => (
                        <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={extFilter.month} onValueChange={v => setExtFilter(f => ({ ...f, month: v, quarter: 'none' }))}>
                    <SelectTrigger className="w-[140px]">
                      <Calendar className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Месяц" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Весь год</SelectItem>
                      {['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'].map((m, i) => (
                        <SelectItem key={i} value={(i + 1).toString()}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={extFilter.quarter} onValueChange={v => setExtFilter(f => ({ ...f, quarter: v, month: 'none' }))}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue placeholder="Квартал" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      <SelectItem value="1">Q1</SelectItem>
                      <SelectItem value="2">Q2</SelectItem>
                      <SelectItem value="3">Q3</SelectItem>
                      <SelectItem value="4">Q4</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-blue-800 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Выручка по дате брони
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-900">
                      {extendedKPI ? fmtCurrency(extendedKPI.revenueByDeposit.value) : '—'}
                    </div>
                    <p className="text-xs text-blue-600 mt-1">
                      {extendedKPI?.revenueByDeposit.count ?? 0} сделок
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-green-800 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Выручка по дате сделки
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-900">
                      {extendedKPI ? fmtCurrency(extendedKPI.revenueByDeal.value) : '—'}
                    </div>
                    <p className="text-xs text-green-600 mt-1">
                      {extendedKPI?.revenueByDeal.count ?? 0} сделок
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-orange-800 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      В задатках выручка
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-900">
                      {extendedKPI ? fmtCurrency(extendedKPI.depositsRevenue.value) : '—'}
                    </div>
                    <p className="text-xs text-orange-600 mt-1">
                      {extendedKPI?.depositsRevenue.count ?? 0} сделок
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-purple-800 flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Выручка ожидаю
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-900">
                      {extendedKPI ? fmtCurrency(extendedKPI.pendingRevenue.value) : '—'}
                    </div>
                    <p className="text-xs text-purple-600 mt-1">
                      {extendedKPI?.pendingRevenue.count ?? 0} сделок
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-teal-50 to-teal-100 border-teal-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-teal-800 flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Сделок на агента/мес
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-teal-900">
                      {extendedKPI?.dealsPerAgent ? extendedKPI.dealsPerAgent.value.toFixed(2) : '—'}
                    </div>
                    <p className="text-xs text-teal-600 mt-1">
                      {extendedKPI?.dealsPerAgent?.totalDeals ?? 0} сделок / {extendedKPI?.dealsPerAgent?.agentCount ?? 0} агент{extendedKPI?.dealsPerAgent?.agentCount === 1 ? '' : 'ов'} / {extendedKPI?.dealsPerAgent?.monthsInPeriod ?? 12} мес
                    </p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content */}
        <Tabs defaultValue="deals" className="space-y-6">
          <TabsList className="flex w-full flex-wrap">
            <TabsTrigger value="deals">Сделки</TabsTrigger>
            {(role === 'AGENT' || role === 'ROP') && (
              <TabsTrigger value="comp">{role === 'AGENT' ? 'Моя ЗП' : 'Комиссии'}</TabsTrigger>
            )}
            {(role === 'OWNER' || role === 'ACCOUNTANT' || role === 'ROP') && (
              <TabsTrigger value="finance">Финансы / P&L</TabsTrigger>
            )}
            {(role === 'OWNER' || role === 'ACCOUNTANT' || role === 'ROP') && (
              <TabsTrigger value="treasury">Казначейство</TabsTrigger>
            )}
            {(role === 'OWNER' || role === 'ACCOUNTANT' || role === 'ROP') && (
              <TabsTrigger value="payroll">Выплаты</TabsTrigger>
            )}
            {(role === 'OWNER' || role === 'ACCOUNTANT' || role === 'LAWYER') && (
              <TabsTrigger value="legal">Юр.услуги</TabsTrigger>
            )}
            {(role === 'OWNER' || role === 'ACCOUNTANT' || role === 'ROP') && (
              <TabsTrigger value="team">Команда</TabsTrigger>
            )}
          </TabsList>

          {/* Deals Tab */}
          <TabsContent value="deals" className="space-y-6">
            <DealsRegistry />
          </TabsContent>

          {(role === 'AGENT' || role === 'ROP') && (
            <TabsContent value="comp">
              <Compensation />
            </TabsContent>
          )}

          {/* Finance Tab */}
          {(role === 'OWNER' || role === 'ACCOUNTANT' || role === 'ROP') && (
            <TabsContent value="finance">
              <FinancePNL />
            </TabsContent>
          )}

          {/* Treasury Tab */}
          {(role === 'OWNER' || role === 'ACCOUNTANT' || role === 'ROP') && (
            <TabsContent value="treasury">
              <Treasury />
            </TabsContent>
          )}

          {(role === 'OWNER' || role === 'ACCOUNTANT' || role === 'ROP') && (
            <TabsContent value="payroll">
              <Payroll />
            </TabsContent>
          )}

          {/* Legal Services Tab */}
          {(role === 'OWNER' || role === 'ACCOUNTANT' || role === 'LAWYER') && (
            <TabsContent value="legal">
              <LegalServicesRegistry />
            </TabsContent>
          )}

          {/* Team Tab */}
          {(role === 'OWNER' || role === 'ACCOUNTANT' || role === 'ROP') && (
            <TabsContent value="team">
              <Team />
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  )
}

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
import { signOut } from 'next-auth/react'
import { useSession } from 'next-auth/react'
import { Badge } from '@/components/ui/badge'
import { DollarSign, FileText, TrendingUp, TrendingDown } from 'lucide-react'
import { MetricHelp } from '@/components/help/metric-help'

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

  const roleLabel = (r: string) => {
    switch (r) {
      case 'OWNER':
        return 'Владелец'
      case 'ACCOUNTANT':
        return 'Бухгалтер'
      case 'ROP':
        return 'РОП'
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
          title: 'Чистая прибыль мес.',
          value: fmt(data.kpis.netProfitMonth ?? 0),
          icon: <TrendingDown className="h-6 w-6" />,
          description: `За текущий месяц · ${data?.kpis?.counts?.netProfitMonth ?? 0} сделок`,
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
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {kpiData.map((kpi, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {kpi.title}
                </CardTitle>
                <div className={kpi.color}>
                  <MetricHelp
                    title={kpi.title}
                    description="Пояснение расчета показателя"
                    trigger={kpi.icon}
                    summary={
                      kpi.title === 'Ожидаю итого'
                        ? 'Показывает, сколько комиссионных в сумме “в работе” по всем не отмененным сделкам.'
                        : kpi.title === 'В задатках'
                          ? 'Показывает, сколько комиссионных приходится на сделки, где уже внесен задаток.'
                          : kpi.title === 'На оплате'
                            ? 'Показывает, сколько комиссионных “в дебиторке”: сделки на финальных этапах, где ждем оплату.'
                            : 'Показывает прибыль по закрытым сделкам за текущий месяц (по формуле сделки).'
                    }
                    details={
                      kpi.title === 'Ожидаю итого' ? (
                        <div className="space-y-2">
                          <div className="font-medium">Как считается</div>
                          <div className="text-muted-foreground">Складываем комиссию агентства по всем сделкам, которые не отменены.</div>
                          <div className="text-muted-foreground">
                            Это “потенциал” по сделкам в работе: часть из них может быть еще на ранних этапах.
                          </div>
                          <div className="text-muted-foreground">Число рядом — сколько сделок попало в расчет.</div>
                        </div>
                      ) : kpi.title === 'В задатках' ? (
                        <div className="space-y-2">
                          <div className="font-medium">Как считается</div>
                          <div className="text-muted-foreground">
                            Складываем комиссию агентства по сделкам со статусом «Задаток» (не отмененные).
                          </div>
                          <div className="text-muted-foreground">Число рядом — сколько таких сделок.</div>
                        </div>
                      ) : kpi.title === 'На оплате' ? (
                        <div className="space-y-2">
                          <div className="font-medium">Как считается</div>
                          <div className="text-muted-foreground">
                            Складываем комиссию агентства по сделкам на этапах «Регистрация / Ожидание счета / Ожидание оплаты» (не отмененные).
                          </div>
                          <div className="text-muted-foreground">Это сумма, которую ожидаем получить в ближайшее время.</div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="font-medium">Как считается</div>
                          <div className="text-muted-foreground">
                            Берем все закрытые сделки текущего месяца и складываем их «чистую прибыль по сделке».
                          </div>
                          <div className="text-muted-foreground">
                            Чистая прибыль по сделке = комиссия агентства − налоги − внешние расходы (юрист/ипотека/реклама по сделке и т.п.) − зарплата (агенту и РОПу).
                          </div>
                          <div className="text-muted-foreground">
                            Важно: это прибыль именно по сделкам, без учета постоянных расходов офиса (аренда, сервисы и т.п.).
                          </div>
                        </div>
                      )
                    }
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpi.value}</div>
                <div className="flex items-center space-x-2 text-xs text-gray-500 mt-1">
                  {kpi.change && (
                    <>
                      <span className={kpi.change > 0 ? 'text-green-600' : 'text-red-600'}>
                        {kpi.change > 0 ? '↑' : '↓'} {Math.abs(kpi.change)}%
                      </span>
                      <span>к прошлому месяцу</span>
                    </>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-2">{kpi.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Content */}
        <Tabs defaultValue="deals" className="space-y-6">
          <TabsList className="flex w-full flex-wrap">
            <TabsTrigger value="deals">Сделки</TabsTrigger>
            {(role === 'AGENT' || role === 'ROP') && (
              <TabsTrigger value="comp">{role === 'AGENT' ? 'Моя ЗП' : 'Комиссии'}</TabsTrigger>
            )}
            {(role === 'OWNER' || role === 'ACCOUNTANT') && (
              <TabsTrigger value="finance">Финансы / P&L</TabsTrigger>
            )}
            {(role === 'OWNER' || role === 'ACCOUNTANT') && (
              <TabsTrigger value="treasury">Казначейство</TabsTrigger>
            )}
            {(role === 'OWNER' || role === 'ACCOUNTANT') && (
              <TabsTrigger value="payroll">Выплаты</TabsTrigger>
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
          {(role === 'OWNER' || role === 'ACCOUNTANT') && (
            <TabsContent value="finance">
              <FinancePNL />
            </TabsContent>
          )}

          {/* Treasury Tab */}
          {(role === 'OWNER' || role === 'ACCOUNTANT') && (
            <TabsContent value="treasury">
              <Treasury />
            </TabsContent>
          )}

          {(role === 'OWNER' || role === 'ACCOUNTANT') && (
            <TabsContent value="payroll">
              <Payroll />
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

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RefreshCw, FileText, Download } from 'lucide-react'

type PayrollType = 'AGENT' | 'ROP'

type Account = { id: string; name: string }

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

type Employee = { id: string; name: string; role: PayrollType; status: string }

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']

export function Payroll() {
  const [loading, setLoading] = useState(true)
  const [accruals, setAccruals] = useState<PayrollAccrual[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])

  const currentYear = new Date().getFullYear()
  const [yearFilter, setYearFilter] = useState(String(currentYear))
  const [monthFilter, setMonthFilter] = useState<string>('all')
  const [quarterFilter, setQuarterFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | PayrollType>('all')
  const [employeeFilter, setEmployeeFilter] = useState<string>('all')

  const [paying, setPaying] = useState<PayrollAccrual | null>(null)
  const [payForm, setPayForm] = useState({ amount: '', paidAt: '', accountId: '', description: '' })
  const [lastPayment, setLastPayment] = useState<{ employee: string; amount: number; date: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(n)

  const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString('ru-RU') : '-')

  const load = useCallback(async () => {
    setLoading(true)
    const qs = new URLSearchParams({
      status: 'all',
      type: typeFilter,
      employeeId: employeeFilter
    })

    const [payrollRes, accountsRes] = await Promise.all([
      fetch(`/api/payroll?${qs.toString()}`, { cache: 'no-store' }),
      fetch('/api/treasury?type=accounts', { cache: 'no-store' })
    ])
    if (!payrollRes.ok) throw new Error('Не удалось загрузить ведомость')
    if (!accountsRes.ok) throw new Error('Не удалось загрузить счета')

    const [payroll, accountsData] = await Promise.all([payrollRes.json(), accountsRes.json()])
    setAccruals(payroll.accruals ?? [])
    setEmployees(payroll.employees ?? [])
    setAccounts((accountsData ?? []).map((a: any) => ({ id: a.id, name: a.name })))
    setLoading(false)
  }, [employeeFilter, typeFilter])

  useEffect(() => {
    load().catch(err => {
      console.error(err)
      setLoading(false)
    })
  }, [load])

  // Фильтрация по периоду
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

  // Группировка по сотрудникам
  const employeeSummary = useMemo(() => {
    const summary: Record<string, { name: string; type: string; accrued: number; paid: number; remaining: number }> = {}

    filteredAccruals.forEach(a => {
      if (!summary[a.employee.id]) {
        summary[a.employee.id] = { name: a.employee.name, type: a.type, accrued: 0, paid: 0, remaining: 0 }
      }
      summary[a.employee.id].accrued += a.amount
      summary[a.employee.id].paid += a.paid
      summary[a.employee.id].remaining += a.remaining
    })

    return Object.entries(summary).map(([id, data]) => ({ id, ...data }))
  }, [filteredAccruals])

  // Средняя ЗП по месяцам
  const monthlyAverageSalary = useMemo(() => {
    const year = Number(yearFilter) || currentYear
    const monthlyData: Record<string, { total: number; agents: Set<string> }> = {}

    // Инициализируем месяцы
    for (let m = 1; m <= 12; m++) {
      const mk = `${year}-${String(m).padStart(2, '0')}`
      monthlyData[mk] = { total: 0, agents: new Set() }
    }

    // Считаем только агентов
    accruals.filter(a => a.type === 'AGENT').forEach(a => {
      const date = new Date(a.deal.dealDate || a.accruedAt)
      if (date.getFullYear() !== year) return
      const mk = `${year}-${String(date.getMonth() + 1).padStart(2, '0')}`
      if (monthlyData[mk]) {
        monthlyData[mk].total += a.amount
        monthlyData[mk].agents.add(a.employee.id)
      }
    })

    // Общее количество активных агентов за год
    const allAgents = new Set<string>()
    accruals.filter(a => a.type === 'AGENT').forEach(a => {
      const date = new Date(a.deal.dealDate || a.accruedAt)
      if (date.getFullYear() === year) allAgents.add(a.employee.id)
    })
    const totalAgents = allAgents.size || 1

    const result = Object.entries(monthlyData).map(([mk, data]) => {
      const [y, m] = mk.split('-').map(Number)
      const agentCount = data.agents.size || totalAgents
      return {
        monthKey: mk,
        month: MONTHS[m - 1] + ' ' + y,
        totalAccrued: data.total,
        agentCount: data.agents.size,
        averageSalary: agentCount > 0 ? Math.round(data.total / agentCount) : 0
      }
    })

    const yearTotal = result.reduce((s, m) => s + m.totalAccrued, 0)
    const yearAverage = totalAgents > 0 ? Math.round(yearTotal / totalAgents / 12) : 0

    return { months: result, yearTotal, totalAgents, yearAverage }
  }, [accruals, yearFilter, currentYear])

  const totals = useMemo(() => {
    const totalAccrued = filteredAccruals.reduce((s, a) => s + a.amount, 0)
    const totalPaid = filteredAccruals.reduce((s, a) => s + a.paid, 0)
    const totalRemaining = filteredAccruals.reduce((s, a) => s + a.remaining, 0)
    return { totalAccrued, totalPaid, totalRemaining }
  }, [filteredAccruals])

  const statusBadge = (s: PayrollAccrual['derivedStatus']) => {
    if (s === 'paid') return { label: 'Выплачено', cls: 'bg-green-100 text-green-800' }
    if (s === 'partially') return { label: 'Частично', cls: 'bg-yellow-100 text-yellow-800' }
    return { label: 'К выплате', cls: 'bg-red-100 text-red-800' }
  }

  const openPay = (a: PayrollAccrual) => {
    setPaying(a)
    setPayForm({
      amount: String(Math.max(0, a.remaining)),
      paidAt: new Date().toISOString().slice(0, 10),
      accountId: accounts[0]?.id ?? '',
      description: ''
    })
  }

  const submitPay = async () => {
    if (!paying || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/payroll/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accrualId: paying.id,
          amount: parseFloat(payForm.amount) || 0,
          paidAt: payForm.paidAt || undefined,
          accountId: payForm.accountId,
          description: payForm.description || undefined
        })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Не удалось создать выплату')
      }

      // Сохраняем данные для документа
      setLastPayment({
        employee: paying.employee.name,
        amount: parseFloat(payForm.amount) || 0,
        date: payForm.paidAt
      })

      setPaying(null)
      await load()
    } finally {
      setSubmitting(false)
    }
  }

  const generatePaymentDocument = () => {
    if (!lastPayment) return

    const doc = `
РАСХОДНЫЙ КАССОВЫЙ ОРДЕР

Дата: ${fmtDate(lastPayment.date)}

Выдать: ${lastPayment.employee}
Сумма: ${fmtMoney(lastPayment.amount)}
(${numberToWords(lastPayment.amount)})

Основание: Выплата заработной платы

Приложение: __________________________________

Руководитель: ________________ / ____________ /

Главный бухгалтер: ________________ / ____________ /

Получил: ________________ / ${lastPayment.employee} /

Дата: ${fmtDate(lastPayment.date)}
    `.trim()

    // Создаём и скачиваем файл
    const blob = new Blob([doc], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `РКО_${lastPayment.employee.replace(/\s/g, '_')}_${lastPayment.date}.txt`
    a.click()
    URL.revokeObjectURL(url)
    setLastPayment(null)
  }

  // Простая функция для суммы прописью
  const numberToWords = (num: number): string => {
    const units = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять', 'десять',
      'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать']
    const tens = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто']
    const hundreds = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот']

    if (num === 0) return 'ноль рублей'

    const rubles = Math.floor(num)
    let result = ''

    if (rubles >= 1000000) {
      const mill = Math.floor(rubles / 1000000)
      result += units[mill] || mill.toString() + ' '
      result += 'миллион '
    }

    if (rubles >= 1000) {
      const thou = Math.floor((rubles % 1000000) / 1000)
      if (thou > 0) {
        if (thou >= 100) result += hundreds[Math.floor(thou / 100)] + ' '
        if (thou % 100 >= 20) {
          result += tens[Math.floor((thou % 100) / 10)] + ' '
          if (thou % 10 > 0) result += (thou % 10 === 1 ? 'одна' : thou % 10 === 2 ? 'две' : units[thou % 10]) + ' '
        } else if (thou % 100 > 0) {
          result += (thou % 100 === 1 ? 'одна' : thou % 100 === 2 ? 'две' : units[thou % 100]) + ' '
        }
        result += 'тысяч '
      }
    }

    const rem = rubles % 1000
    if (rem >= 100) result += hundreds[Math.floor(rem / 100)] + ' '
    if (rem % 100 >= 20) {
      result += tens[Math.floor((rem % 100) / 10)] + ' '
      if (rem % 10 > 0) result += units[rem % 10] + ' '
    } else if (rem % 100 > 0) {
      result += units[rem % 100] + ' '
    }

    result += 'рублей'
    return result.trim()
  }

  const yearOptions = Array.from({ length: 5 }, (_, i) => String(currentYear - i))

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Загрузка ведомости...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Ведомость выплат</h2>
          <p className="text-gray-500">Начисления по сделкам с датой сделки и выплаты</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <Button variant="outline" onClick={() => load().catch(err => alert(err.message))}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Обновить
          </Button>
          {lastPayment && (
            <Button onClick={generatePaymentDocument}>
              <Download className="h-4 w-4 mr-2" />
              Скачать РКО
            </Button>
          )}
        </div>
      </div>

      {/* Фильтры */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Фильтры</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <Select value={yearFilter} onValueChange={v => { setYearFilter(v); setMonthFilter('all'); setQuarterFilter('all') }}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все</SelectItem>
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
              <SelectItem value="all">Все месяцы</SelectItem>
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
              <SelectItem value="all">Все кварталы</SelectItem>
              <SelectItem value="1">Q1</SelectItem>
              <SelectItem value="2">Q2</SelectItem>
              <SelectItem value="3">Q3</SelectItem>
              <SelectItem value="4">Q4</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={v => setTypeFilter(v as any)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Тип" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все</SelectItem>
              <SelectItem value="AGENT">Агент</SelectItem>
              <SelectItem value="ROP">РОП</SelectItem>
            </SelectContent>
          </Select>
          <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Сотрудник" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все</SelectItem>
              {employees.map(e => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name} ({e.role === 'AGENT' ? 'Агент' : 'РОП'})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Сводные карточки */}
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
          <TabsTrigger value="average">Средняя ЗП</TabsTrigger>
        </TabsList>

        {/* Таб 1: Начислено */}
        <TabsContent value="accrued">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Начисления</CardTitle>
              <CardDescription>Все начисления по сделкам</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Сотрудник</TableHead>
                    <TableHead>Тип</TableHead>
                    <TableHead className="text-right">Начислено</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employeeSummary.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-gray-500">
                        Нет данных
                      </TableCell>
                    </TableRow>
                  ) : (
                    employeeSummary.map(e => (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium">{e.name}</TableCell>
                        <TableCell>{e.type === 'AGENT' ? 'Агент' : 'РОП'}</TableCell>
                        <TableCell className="text-right font-medium">{fmtMoney(e.accrued)}</TableCell>
                      </TableRow>
                    ))
                  )}
                  <TableRow className="bg-gray-50 font-bold">
                    <TableCell colSpan={2}>Итого</TableCell>
                    <TableCell className="text-right">{fmtMoney(totals.totalAccrued)}</TableCell>
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
              <CardTitle className="text-lg">Выплачено</CardTitle>
              <CardDescription>Фактические выплаты сотрудникам</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Сотрудник</TableHead>
                    <TableHead>Тип</TableHead>
                    <TableHead className="text-right">Выплачено</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employeeSummary.filter(e => e.paid > 0).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-gray-500">
                        Нет выплат
                      </TableCell>
                    </TableRow>
                  ) : (
                    employeeSummary.filter(e => e.paid > 0).map(e => (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium">{e.name}</TableCell>
                        <TableCell>{e.type === 'AGENT' ? 'Агент' : 'РОП'}</TableCell>
                        <TableCell className="text-right font-medium text-green-700">{fmtMoney(e.paid)}</TableCell>
                      </TableRow>
                    ))
                  )}
                  <TableRow className="bg-gray-50 font-bold">
                    <TableCell colSpan={2}>Итого</TableCell>
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
              <CardDescription>Остаток к выплате по сотрудникам</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Сотрудник</TableHead>
                    <TableHead>Тип</TableHead>
                    <TableHead className="text-right">Начислено</TableHead>
                    <TableHead className="text-right">Выплачено</TableHead>
                    <TableHead className="text-right">К выплате</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employeeSummary.filter(e => e.remaining > 0).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                        Все выплачено
                      </TableCell>
                    </TableRow>
                  ) : (
                    employeeSummary.filter(e => e.remaining > 0).map(e => (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium">{e.name}</TableCell>
                        <TableCell>{e.type === 'AGENT' ? 'Агент' : 'РОП'}</TableCell>
                        <TableCell className="text-right">{fmtMoney(e.accrued)}</TableCell>
                        <TableCell className="text-right text-green-700">{fmtMoney(e.paid)}</TableCell>
                        <TableCell className="text-right font-bold text-orange-700">{fmtMoney(e.remaining)}</TableCell>
                      </TableRow>
                    ))
                  )}
                  <TableRow className="bg-gray-50 font-bold">
                    <TableCell colSpan={2}>Итого</TableCell>
                    <TableCell className="text-right">{fmtMoney(totals.totalAccrued)}</TableCell>
                    <TableCell className="text-right text-green-700">{fmtMoney(totals.totalPaid)}</TableCell>
                    <TableCell className="text-right text-orange-700">{fmtMoney(totals.totalRemaining)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Детальный список начислений к выплате */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-lg">Детализация начислений к выплате</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Сотрудник</TableHead>
                    <TableHead>Сделка</TableHead>
                    <TableHead>Дата сделки</TableHead>
                    <TableHead className="text-right">Начислено</TableHead>
                    <TableHead className="text-right">Выплачено</TableHead>
                    <TableHead className="text-right">Остаток</TableHead>
                    <TableHead className="w-[120px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAccruals.filter(a => a.remaining > 0).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                        Нет начислений к выплате
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAccruals.filter(a => a.remaining > 0).map(a => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">
                          {a.employee.name} <span className="text-gray-500">({a.type === 'AGENT' ? 'Агент' : 'РОП'})</span>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{a.deal.client}</div>
                          <div className="text-xs text-gray-500 max-w-[300px] truncate">{a.deal.object}</div>
                        </TableCell>
                        <TableCell>{fmtDate(a.deal.dealDate ?? a.accruedAt)}</TableCell>
                        <TableCell className="text-right">{fmtMoney(a.amount)}</TableCell>
                        <TableCell className="text-right">{fmtMoney(a.paid)}</TableCell>
                        <TableCell className="text-right font-medium">{fmtMoney(a.remaining)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => openPay(a)}>
                            Выплатить
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Таб 4: Средняя ЗП */}
        <TabsContent value="average">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Средняя ЗП агентов</CardTitle>
              <CardDescription>
                Средняя ЗП = сумма начислений всех агентов / кол-во агентов.
                За {yearFilter === 'all' ? 'все время' : yearFilter + ' год'}: всего <b>{monthlyAverageSalary.totalAgents}</b> агентов.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Месяц</TableHead>
                    <TableHead className="text-right">Начислено всего</TableHead>
                    <TableHead className="text-right">Кол-во агентов</TableHead>
                    <TableHead className="text-right">Средняя ЗП</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthlyAverageSalary.months.map(m => (
                    <TableRow key={m.monthKey}>
                      <TableCell className="font-medium">{m.month}</TableCell>
                      <TableCell className="text-right">{m.totalAccrued > 0 ? fmtMoney(m.totalAccrued) : '-'}</TableCell>
                      <TableCell className="text-right">{m.agentCount || '-'}</TableCell>
                      <TableCell className="text-right font-medium">
                        {m.averageSalary > 0 ? fmtMoney(m.averageSalary) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-gray-50 font-bold">
                    <TableCell>Итого за год</TableCell>
                    <TableCell className="text-right">{fmtMoney(monthlyAverageSalary.yearTotal)}</TableCell>
                    <TableCell className="text-right">{monthlyAverageSalary.totalAgents} агентов</TableCell>
                    <TableCell className="text-right">
                      {fmtMoney(monthlyAverageSalary.yearAverage)} / мес
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Диалог выплаты */}
      <Dialog open={!!paying} onOpenChange={() => setPaying(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Выплата</DialogTitle>
            <DialogDescription>Можно выплачивать частями. После создания будет доступна кнопка скачивания РКО.</DialogDescription>
          </DialogHeader>
          {paying && (
            <div className="space-y-4">
              <div>
                <div className="text-sm text-gray-600">Сотрудник</div>
                <div className="font-medium">{paying.employee.name}</div>
                <div className="text-xs text-gray-500">Остаток к выплате: {fmtMoney(paying.remaining)}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Сумма</Label>
                  <Input value={payForm.amount} type="number" onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))} />
                </div>
                <div>
                  <Label>Дата выплаты</Label>
                  <Input value={payForm.paidAt} type="date" onChange={e => setPayForm(p => ({ ...p, paidAt: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <Label>Счет</Label>
                  <Select value={payForm.accountId} onValueChange={v => setPayForm(p => ({ ...p, accountId: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите счет" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map(a => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label>Комментарий (необязательно)</Label>
                  <Input value={payForm.description} onChange={e => setPayForm(p => ({ ...p, description: e.target.value }))} />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPaying(null)}>
                  Отмена
                </Button>
                <Button
                  onClick={() => submitPay().catch(err => alert(err.message))}
                  disabled={submitting || !payForm.accountId || (parseFloat(payForm.amount) || 0) <= 0}
                >
                  {submitting ? 'Создание...' : 'Создать выплату'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

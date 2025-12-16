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
import { RefreshCw } from 'lucide-react'

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

export function Payroll() {
  const [loading, setLoading] = useState(true)
  const [accruals, setAccruals] = useState<PayrollAccrual[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])

  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'partially' | 'paid'>('unpaid')
  const [typeFilter, setTypeFilter] = useState<'all' | PayrollType>('all')
  const [employeeFilter, setEmployeeFilter] = useState<string>('all')

  const [paying, setPaying] = useState<PayrollAccrual | null>(null)
  const [payForm, setPayForm] = useState({ amount: '', paidAt: '', accountId: '', description: '' })

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(n)

  const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString('ru-RU') : '-')

  const load = useCallback(async () => {
    setLoading(true)
    const qs = new URLSearchParams({
      status: statusFilter,
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
  }, [employeeFilter, statusFilter, typeFilter])

  useEffect(() => {
    load().catch(err => {
      console.error(err)
      setLoading(false)
    })
  }, [load])

  const totals = useMemo(() => {
    const totalAccrued = accruals.reduce((s, a) => s + a.amount, 0)
    const totalPaid = accruals.reduce((s, a) => s + a.paid, 0)
    const totalRemaining = accruals.reduce((s, a) => s + a.remaining, 0)
    return { totalAccrued, totalPaid, totalRemaining }
  }, [accruals])

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
    if (!paying) return
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
    setPaying(null)
    await load()
  }

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
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Ведомость выплат</h2>
          <p className="text-gray-500">Начисления по закрытым сделкам и частичные выплаты через казначейство</p>
        </div>
        <Button variant="outline" onClick={() => load().catch(err => alert(err.message))}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Обновить
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Начислено</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmtMoney(totals.totalAccrued)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Выплачено</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmtMoney(totals.totalPaid)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">К выплате</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmtMoney(totals.totalRemaining)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Фильтры</CardTitle>
          <CardDescription>Фильтрация по статусу выплаты, типу и сотруднику</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <Select value={statusFilter} onValueChange={v => setStatusFilter(v as any)}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unpaid">К выплате</SelectItem>
              <SelectItem value="partially">Частично</SelectItem>
              <SelectItem value="paid">Выплачено</SelectItem>
              <SelectItem value="all">Все</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={v => setTypeFilter(v as any)}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Тип" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все</SelectItem>
              <SelectItem value="AGENT">Агент</SelectItem>
              <SelectItem value="ROP">РОП</SelectItem>
            </SelectContent>
          </Select>
          <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
            <SelectTrigger className="w-[260px]">
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

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Начисления</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Сотрудник</TableHead>
                <TableHead>Сделка</TableHead>
                <TableHead>Дата закрытия</TableHead>
                <TableHead className="text-right">Начислено</TableHead>
                <TableHead className="text-right">Выплачено</TableHead>
                <TableHead className="text-right">Остаток</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="w-[140px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accruals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    Начисления не найдены
                  </TableCell>
                </TableRow>
              ) : (
                accruals.map(a => {
                  const b = statusBadge(a.derivedStatus)
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">
                        {a.employee.name} <span className="text-gray-500">({a.type === 'AGENT' ? 'Агент' : 'РОП'})</span>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{a.deal.client}</div>
                        <div className="text-xs text-gray-500 max-w-[360px] truncate" title={a.deal.object}>
                          {a.deal.object}
                        </div>
                      </TableCell>
                      <TableCell>{fmtDate(a.deal.dealDate ?? a.accruedAt)}</TableCell>
                      <TableCell className="text-right font-medium">{fmtMoney(a.amount)}</TableCell>
                      <TableCell className="text-right">{fmtMoney(a.paid)}</TableCell>
                      <TableCell className="text-right font-medium">{fmtMoney(a.remaining)}</TableCell>
                      <TableCell>
                        <Badge className={b.cls}>{b.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" disabled={a.remaining <= 0} onClick={() => openPay(a)}>
                          Выплатить
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!paying} onOpenChange={() => setPaying(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Выплата</DialogTitle>
            <DialogDescription>Можно выплачивать частями. Выплата создаст операцию в казначействе.</DialogDescription>
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
                  disabled={!payForm.accountId || (parseFloat(payForm.amount) || 0) <= 0}
                >
                  Создать выплату
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

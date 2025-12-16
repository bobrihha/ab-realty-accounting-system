'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle, Edit, Plus, RefreshCw, Trash2, TrendingUp, Wallet } from 'lucide-react'

type AccountType = 'BANK' | 'CASH' | 'DIGITAL'
type CashFlowType = 'INCOME' | 'EXPENSE'

type Account = {
  id: string
  name: string
  balance: number
  type: AccountType
}

type CashFlowItem = {
  id: string
  type: CashFlowType
  amount: number
  category: string
  plannedDate: string
  actualDate: string | null
  description: string | null
  accountId: string
  account: Account
}

type MonthlyForecast = {
  month: string
  monthKey: string
  openingBalance: number
  expectedIncome: number
  plannedExpenses: number
  closingBalance: number
  status: 'positive' | 'critical'
}

export function Treasury() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [cashFlow, setCashFlow] = useState<CashFlowItem[]>([])
  const [forecast, setForecast] = useState<MonthlyForecast[]>([])
  const [loading, setLoading] = useState(true)

  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false)
  const [isCashFlowDialogOpen, setIsCashFlowDialogOpen] = useState(false)
  const [isEditAccountDialogOpen, setIsEditAccountDialogOpen] = useState(false)

  const [editingCashFlow, setEditingCashFlow] = useState<CashFlowItem | null>(null)
  const [isEditCashFlowDialogOpen, setIsEditCashFlowDialogOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)

  const [newAccount, setNewAccount] = useState({ name: '', balance: '', type: 'BANK' as AccountType })
  const [editAccount, setEditAccount] = useState({ name: '', balance: '', type: 'BANK' as AccountType })
  const [newCashFlow, setNewCashFlow] = useState({
    type: 'INCOME' as CashFlowType,
    amount: '',
    category: '',
    plannedDate: '',
    description: '',
    accountId: '',
    plannedOnly: false
  })

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/treasury?months=12', { cache: 'no-store' })
    if (!res.ok) throw new Error('Не удалось загрузить казначейство')
    const data = await res.json()
    setAccounts(data.accounts ?? [])
    setCashFlow(data.cashFlow ?? [])
    setForecast(data.forecast ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load().catch(err => {
      console.error(err)
      setLoading(false)
    })
  }, [])

  const totalBalance = useMemo(() => accounts.reduce((sum, a) => sum + (a.balance || 0), 0), [accounts])
  const hasCashGap = useMemo(() => forecast.some(f => f.status === 'critical'), [forecast])

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(amount)

  const formatDate = (dateString: string | null) => (dateString ? new Date(dateString).toLocaleDateString('ru-RU') : '-')

  const accountTypeLabel: Record<AccountType, string> = {
    BANK: 'Банк',
    CASH: 'Наличные',
    DIGITAL: 'Электронный'
  }

  const statusBadge = (status: MonthlyForecast['status']) => {
    if (status === 'critical') return { label: 'Кассовый разрыв', cls: 'bg-red-100 text-red-800' }
    return { label: 'ОК', cls: 'bg-green-100 text-green-800' }
  }

  const openEditCashFlow = (item: CashFlowItem) => {
    setEditingCashFlow(item)
    setNewCashFlow({
      type: item.type,
      amount: String(item.amount),
      category: item.category,
      plannedDate: item.plannedDate.slice(0, 10),
      description: item.description ?? '',
      accountId: item.accountId,
      plannedOnly: item.actualDate === null
    })
    setIsEditCashFlowDialogOpen(true)
  }

  const openEditAccount = (account: Account) => {
    setEditingAccount(account)
    setEditAccount({ name: account.name, balance: String(account.balance), type: account.type })
    setIsEditAccountDialogOpen(true)
  }

  const handleAddAccount = async () => {
    const res = await fetch('/api/treasury?type=account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newAccount.name,
        balance: parseFloat(newAccount.balance) || 0,
        type: newAccount.type
      })
    })
    if (!res.ok) throw new Error('Не удалось создать счет')
    setIsAccountDialogOpen(false)
    setNewAccount({ name: '', balance: '', type: 'BANK' })
    await load()
  }

  const handleUpdateAccount = async () => {
    if (!editingAccount) return
    const res = await fetch(`/api/accounts/${editingAccount.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editAccount.name,
        balance: parseFloat(editAccount.balance) || 0,
        type: editAccount.type
      })
    })
    if (!res.ok) throw new Error('Не удалось обновить счет')
    setIsEditAccountDialogOpen(false)
    setEditingAccount(null)
    setEditAccount({ name: '', balance: '', type: 'BANK' })
    await load()
  }

  const handleDeleteAccount = async (accountId: string) => {
    if (!confirm('Удалить счет? Операции по нему также будут удалены.')) return
    const res = await fetch(`/api/accounts/${accountId}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Не удалось удалить счет')
    await load()
  }

  const handleAddCashFlow = async () => {
    if (!newCashFlow.accountId) throw new Error('Выберите счет')
    const plannedDate = newCashFlow.plannedDate ? newCashFlow.plannedDate : new Date().toISOString().slice(0, 10)

    const res = await fetch('/api/treasury?type=cashflow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: newCashFlow.type,
        amount: parseFloat(newCashFlow.amount) || 0,
        category: newCashFlow.category,
        plannedDate,
        actualDate: newCashFlow.plannedOnly ? null : plannedDate,
        description: newCashFlow.description || null,
        accountId: newCashFlow.accountId
      })
    })
    if (!res.ok) throw new Error('Не удалось добавить операцию')
    setIsCashFlowDialogOpen(false)
    setNewCashFlow({ type: 'INCOME', amount: '', category: '', plannedDate: '', description: '', accountId: '', plannedOnly: false })
    await load()
  }

  const handleUpdateCashFlow = async () => {
    if (!editingCashFlow) return
    if (!newCashFlow.accountId) throw new Error('Выберите счет')
    const plannedDate = newCashFlow.plannedDate ? newCashFlow.plannedDate : new Date().toISOString().slice(0, 10)

    const res = await fetch(`/api/cash-flow/${editingCashFlow.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: newCashFlow.type,
        amount: parseFloat(newCashFlow.amount) || 0,
        category: newCashFlow.category,
        plannedDate,
        actualDate: newCashFlow.plannedOnly ? null : plannedDate,
        description: newCashFlow.description || null,
        accountId: newCashFlow.accountId
      })
    })

    if (!res.ok) throw new Error('Не удалось обновить операцию')
    setIsEditCashFlowDialogOpen(false)
    setEditingCashFlow(null)
    setNewCashFlow({ type: 'INCOME', amount: '', category: '', plannedDate: '', description: '', accountId: '', plannedOnly: false })
    await load()
  }

  const handleDeleteCashFlow = async (id: string) => {
    if (!confirm('Удалить операцию? Баланс счета будет скорректирован.')) return
    const res = await fetch(`/api/cash-flow/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Не удалось удалить операцию')
    await load()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Загрузка казначейства...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Казначейство</h2>
          <p className="text-gray-500">Счета, операции и прогноз кассовых разрывов</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => load().catch(err => alert(err.message))}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Обновить
          </Button>

          <Dialog open={isAccountDialogOpen} onOpenChange={setIsAccountDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Счет
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Добавить счет</DialogTitle>
                <DialogDescription>Остаток вводится вручную</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Название</Label>
                  <Input value={newAccount.name} onChange={e => setNewAccount(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <Label>Остаток</Label>
                  <Input value={newAccount.balance} type="number" onChange={e => setNewAccount(p => ({ ...p, balance: e.target.value }))} />
                </div>
                <div>
                  <Label>Тип</Label>
                  <select
                    className="w-full border rounded-md p-2"
                    value={newAccount.type}
                    onChange={e => setNewAccount(p => ({ ...p, type: e.target.value as AccountType }))}
                  >
                    <option value="BANK">Банк</option>
                    <option value="CASH">Наличные</option>
                    <option value="DIGITAL">Электронный</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsAccountDialogOpen(false)}>
                    Отмена
                  </Button>
                  <Button onClick={() => handleAddAccount().catch(err => alert(err.message))}>Добавить</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isCashFlowDialogOpen} onOpenChange={setIsCashFlowDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Операция
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Добавить операцию</DialogTitle>
                <DialogDescription>План/факт фиксируются отдельными датами</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Тип</Label>
                  <select
                    className="w-full border rounded-md p-2"
                    value={newCashFlow.type}
                    onChange={e => setNewCashFlow(p => ({ ...p, type: e.target.value as CashFlowType }))}
                  >
                    <option value="INCOME">Приход</option>
                    <option value="EXPENSE">Расход</option>
                  </select>
                </div>
                <div>
                  <Label>Сумма</Label>
                  <Input
                    value={newCashFlow.amount}
                    type="number"
                    onChange={e => setNewCashFlow(p => ({ ...p, amount: e.target.value }))}
                  />
                </div>
                <div className="col-span-2">
                  <Label>Категория</Label>
                  <Input value={newCashFlow.category} onChange={e => setNewCashFlow(p => ({ ...p, category: e.target.value }))} />
                </div>
                <div>
                  <Label>Дата (план)</Label>
                  <Input
                    value={newCashFlow.plannedDate}
                    type="date"
                    onChange={e => setNewCashFlow(p => ({ ...p, plannedDate: e.target.value }))}
                  />
                </div>
                <div className="flex items-center space-x-2 pt-6">
                  <input
                    type="checkbox"
                    checked={newCashFlow.plannedOnly}
                    onChange={e => setNewCashFlow(p => ({ ...p, plannedOnly: e.target.checked }))}
                    className="rounded"
                    id="plannedOnly"
                  />
                  <Label htmlFor="plannedOnly">Только план (без факта)</Label>
                </div>
                <div className="col-span-2">
                  <Label>Счет</Label>
                  <select
                    className="w-full border rounded-md p-2"
                    value={newCashFlow.accountId}
                    onChange={e => setNewCashFlow(p => ({ ...p, accountId: e.target.value }))}
                  >
                    <option value="">Выберите счет</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <Label>Описание</Label>
                  <Input value={newCashFlow.description} onChange={e => setNewCashFlow(p => ({ ...p, description: e.target.value }))} />
                </div>
                <div className="col-span-2 flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsCashFlowDialogOpen(false)}>
                    Отмена
                  </Button>
                  <Button onClick={() => handleAddCashFlow().catch(err => alert(err.message))}>Добавить</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {hasCashGap && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Обнаружен кассовый разрыв (отрицательный прогноз баланса).</AlertDescription>
        </Alert>
      )}

      <Dialog open={isEditCashFlowDialogOpen} onOpenChange={setIsEditCashFlowDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать операцию</DialogTitle>
            <DialogDescription>При изменении факта баланс счета будет скорректирован</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Тип</Label>
              <select
                className="w-full border rounded-md p-2"
                value={newCashFlow.type}
                onChange={e => setNewCashFlow(p => ({ ...p, type: e.target.value as CashFlowType }))}
              >
                <option value="INCOME">Приход</option>
                <option value="EXPENSE">Расход</option>
              </select>
            </div>
            <div>
              <Label>Сумма</Label>
              <Input value={newCashFlow.amount} type="number" onChange={e => setNewCashFlow(p => ({ ...p, amount: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <Label>Категория</Label>
              <Input value={newCashFlow.category} onChange={e => setNewCashFlow(p => ({ ...p, category: e.target.value }))} />
            </div>
            <div>
              <Label>Дата (план)</Label>
              <Input
                value={newCashFlow.plannedDate}
                type="date"
                onChange={e => setNewCashFlow(p => ({ ...p, plannedDate: e.target.value }))}
              />
            </div>
            <div className="flex items-center space-x-2 pt-6">
              <input
                type="checkbox"
                checked={newCashFlow.plannedOnly}
                onChange={e => setNewCashFlow(p => ({ ...p, plannedOnly: e.target.checked }))}
                className="rounded"
                id="plannedOnlyEdit"
              />
              <Label htmlFor="plannedOnlyEdit">Только план (без факта)</Label>
            </div>
            <div className="col-span-2">
              <Label>Счет</Label>
              <select
                className="w-full border rounded-md p-2"
                value={newCashFlow.accountId}
                onChange={e => setNewCashFlow(p => ({ ...p, accountId: e.target.value }))}
              >
                <option value="">Выберите счет</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <Label>Описание</Label>
              <Input value={newCashFlow.description} onChange={e => setNewCashFlow(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="col-span-2 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditCashFlowDialogOpen(false)}>
                Отмена
              </Button>
              <Button onClick={() => handleUpdateCashFlow().catch(err => alert(err.message))}>Сохранить</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditAccountDialogOpen} onOpenChange={setIsEditAccountDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать счет</DialogTitle>
            <DialogDescription>Изменение остатка перезапишет текущее значение баланса счета</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Название</Label>
              <Input value={editAccount.name} onChange={e => setEditAccount(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <Label>Остаток</Label>
              <Input
                value={editAccount.balance}
                type="number"
                onChange={e => setEditAccount(p => ({ ...p, balance: e.target.value }))}
              />
            </div>
            <div>
              <Label>Тип</Label>
              <select
                className="w-full border rounded-md p-2"
                value={editAccount.type}
                onChange={e => setEditAccount(p => ({ ...p, type: e.target.value as AccountType }))}
              >
                <option value="BANK">Банк</option>
                <option value="CASH">Наличные</option>
                <option value="DIGITAL">Электронный</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditAccountDialogOpen(false)}>
                Отмена
              </Button>
              <Button onClick={() => handleUpdateAccount().catch(err => alert(err.message))}>Сохранить</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Общий остаток
            </CardTitle>
            <CardDescription>Сумма остатков по счетам</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(totalBalance)}</div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Счета
            </CardTitle>
            <CardDescription>Остатки вводятся вручную (текущее)</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Название</TableHead>
                  <TableHead>Тип</TableHead>
                  <TableHead className="text-right">Остаток</TableHead>
                  <TableHead className="w-[120px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{accountTypeLabel[a.type]}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(a.balance)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEditAccount(a)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteAccount(a.id).catch(err => alert(err.message))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Платежный календарь (прогноз)</CardTitle>
          <CardDescription>Баланс = Остаток сейчас + Ожидаемый приход (сделки) - Оставшиеся расходы (план)</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Месяц</TableHead>
                <TableHead className="text-right">Открытие</TableHead>
                <TableHead className="text-right">Ожидаю приход</TableHead>
                <TableHead className="text-right">План расходов</TableHead>
                <TableHead className="text-right">Закрытие</TableHead>
                <TableHead>Статус</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {forecast.map(f => {
                const s = statusBadge(f.status)
                return (
                  <TableRow key={f.monthKey}>
                    <TableCell className="font-medium">{f.month}</TableCell>
                    <TableCell className="text-right">{formatCurrency(f.openingBalance)}</TableCell>
                    <TableCell className="text-right text-green-700">{formatCurrency(f.expectedIncome)}</TableCell>
                    <TableCell className="text-right text-red-700">{formatCurrency(f.plannedExpenses)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(f.closingBalance)}</TableCell>
                    <TableCell>
                      <Badge className={s.cls}>{s.label}</Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Операции</CardTitle>
          <CardDescription>Единая база всех транзакций (план/факт)</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Тип</TableHead>
                <TableHead>Категория</TableHead>
                <TableHead>Счет</TableHead>
                <TableHead>План</TableHead>
                <TableHead>Факт</TableHead>
                <TableHead className="text-right">Сумма</TableHead>
                <TableHead className="w-[120px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cashFlow.map(c => (
                <TableRow key={c.id}>
                  <TableCell>{c.type === 'INCOME' ? 'Приход' : 'Расход'}</TableCell>
                  <TableCell>{c.category}</TableCell>
                  <TableCell>{c.account?.name ?? '-'}</TableCell>
                  <TableCell>{formatDate(c.plannedDate)}</TableCell>
                  <TableCell>{formatDate(c.actualDate)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(c.amount)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEditCashFlow(c)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteCashFlow(c.id).catch(err => alert(err.message))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Search, Plus, Edit, Trash2, Eye, RefreshCw, DollarSign } from 'lucide-react'

type DealStatus = 'DEPOSIT' | 'REGISTRATION' | 'WAITING_INVOICE' | 'WAITING_PAYMENT' | 'CLOSED' | 'CANCELLED'
type ContractType = 'EXCLUSIVE' | 'SELECTION' | 'DEVELOPER'
type Employee = { id: string; name: string }

type Deal = {
  id: string
  client: string
  object: string
  price: number
  commission: number
  status: DealStatus
  depositDate: string
  dealDate: string | null
  plannedCloseDate: string | null
  contractType: ContractType
  legalServices: boolean
  notes: string | null
  taxRate: number
  externalExpenses: number
  ropCommission: number | null
  agentCommission: number | null
  netProfit: number | null
  commissionsManual: boolean
  agent: Employee
  rop: Employee | null
}

const statusConfig: Record<DealStatus, { label: string; color: string }> = {
  DEPOSIT: { label: 'Задаток', color: 'bg-orange-100 text-orange-800' },
  REGISTRATION: { label: 'На регистрации', color: 'bg-blue-100 text-blue-800' },
  WAITING_INVOICE: { label: 'Ждем счет', color: 'bg-indigo-100 text-indigo-800' },
  WAITING_PAYMENT: { label: 'На оплате', color: 'bg-purple-100 text-purple-800' },
  CLOSED: { label: 'Закрыта', color: 'bg-green-100 text-green-800' },
  CANCELLED: { label: 'Срыв', color: 'bg-red-100 text-red-800' }
}

const contractTypeLabels: Record<ContractType, string> = {
  EXCLUSIVE: 'Эксклюзив',
  SELECTION: 'Подбор',
  DEVELOPER: 'Застройщик'
}

export function DealsRegistry() {
  const { data: session } = useSession()
  const role = ((session as any)?.role as string | undefined) ?? 'AGENT'
  const isOwner = role === 'OWNER'
  const [deals, setDeals] = useState<Deal[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [agentFilter, setAgentFilter] = useState<string>('all')

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null)
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null)

  const [formData, setFormData] = useState({
    client: '',
    object: '',
    price: '',
    commission: '',
    agentId: '',
    status: 'DEPOSIT' as DealStatus,
    depositDate: '',
    dealDate: '',
    plannedCloseDate: '',
    contractType: 'EXCLUSIVE' as ContractType,
    legalServices: false,
    notes: '',
    taxRate: '6',
    externalExpenses: '0',
    commissionsManual: false
  })

  const load = async () => {
    setLoading(true)
    const [dealsRes, empRes] = await Promise.all([
      fetch('/api/deals', { cache: 'no-store' }),
      fetch('/api/employees', { cache: 'no-store' })
    ])
    if (!dealsRes.ok) throw new Error('Failed to load deals')
    if (!empRes.ok) throw new Error('Failed to load employees')
    const [dealsData, empData] = await Promise.all([dealsRes.json(), empRes.json()])
    setDeals(dealsData)
    setEmployees(empData.map((e: any) => ({ id: e.id, name: e.name })))
    setLoading(false)
  }

  useEffect(() => {
    load().catch(err => {
      console.error(err)
      setLoading(false)
    })
  }, [])

  const filteredDeals = useMemo(() => {
    const s = searchTerm.trim().toLowerCase()
    return deals.filter(deal => {
      const matchesSearch =
        !s ||
        deal.client.toLowerCase().includes(s) ||
        deal.object.toLowerCase().includes(s) ||
        deal.agent.name.toLowerCase().includes(s)
      const matchesStatus = statusFilter === 'all' || deal.status === statusFilter
      const matchesAgent = agentFilter === 'all' || deal.agent.id === agentFilter
      return matchesSearch && matchesStatus && matchesAgent
    })
  }, [agentFilter, deals, searchTerm, statusFilter])

  const resetForm = () => {
    setFormData({
      client: '',
      object: '',
      price: '',
      commission: '',
      agentId: '',
      status: 'DEPOSIT',
      depositDate: '',
      dealDate: '',
      plannedCloseDate: '',
      contractType: 'EXCLUSIVE',
      legalServices: false,
      notes: '',
      taxRate: '6',
      externalExpenses: '0',
      commissionsManual: false
    })
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(amount)

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('ru-RU')

  const handleCreateDeal = async () => {
    const payload = {
      client: formData.client,
      object: formData.object,
      price: parseFloat(formData.price) || 0,
      commission: parseFloat(formData.commission) || 0,
      agentId: formData.agentId || undefined,
      status: formData.status,
      depositDate: formData.depositDate || undefined,
      dealDate: formData.dealDate || undefined,
      plannedCloseDate: formData.plannedCloseDate || undefined,
      contractType: formData.contractType,
      legalServices: formData.legalServices,
      notes: formData.notes || undefined,
      taxRate: parseFloat(formData.taxRate) || 6,
      externalExpenses: parseFloat(formData.externalExpenses) || 0,
      commissionsManual: formData.commissionsManual
    }

    const res = await fetch('/api/deals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (!res.ok) throw new Error('Failed to create deal')
    await load()
    setIsCreateDialogOpen(false)
    resetForm()
  }

  const handleUpdateDeal = async () => {
    if (!editingDeal) return
    const res = await fetch(`/api/deals/${editingDeal.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client: editingDeal.client,
        object: editingDeal.object,
        price: editingDeal.price,
        commission: editingDeal.commission,
        status: editingDeal.status,
        depositDate: editingDeal.depositDate,
        dealDate: editingDeal.dealDate,
        plannedCloseDate: editingDeal.plannedCloseDate,
        contractType: editingDeal.contractType,
        legalServices: editingDeal.legalServices,
        notes: editingDeal.notes,
        taxRate: editingDeal.taxRate,
        externalExpenses: editingDeal.externalExpenses,
        commissionsManual: editingDeal.commissionsManual,
        ropCommission: editingDeal.ropCommission,
        agentCommission: editingDeal.agentCommission,
        netProfit: editingDeal.netProfit
      })
    })
    if (!res.ok) throw new Error('Failed to update deal')
    await load()
    setEditingDeal(null)
  }

  const handleDeleteDeal = async (dealId: string) => {
    if (!confirm('Вы уверены, что хотите удалить эту сделку?')) return
    const res = await fetch(`/api/deals/${dealId}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to delete deal')
    await load()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Загрузка сделок...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Реестр сделок</h2>
          <p className="text-gray-500">Данные вводятся в сделках и используются в расчетах</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => load()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Обновить
          </Button>
          {isOwner && (
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Новая сделка
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Создание сделки</DialogTitle>
                  <DialogDescription>Заполните карточку сделки</DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4 py-4">
                  <div className="col-span-2">
                    <Label htmlFor="client">Клиент</Label>
                    <Input id="client" value={formData.client} onChange={e => setFormData(p => ({ ...p, client: e.target.value }))} />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="object">Объект</Label>
                    <Input id="object" value={formData.object} onChange={e => setFormData(p => ({ ...p, object: e.target.value }))} />
                  </div>
                  <div>
                    <Label htmlFor="price">Цена</Label>
                    <Input id="price" type="number" value={formData.price} onChange={e => setFormData(p => ({ ...p, price: e.target.value }))} />
                  </div>
                  <div>
                    <Label htmlFor="commission">Комиссия агентства (вал)</Label>
                    <Input
                      id="commission"
                      type="number"
                      value={formData.commission}
                      onChange={e => setFormData(p => ({ ...p, commission: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Агент</Label>
                    <Select value={formData.agentId} onValueChange={value => setFormData(p => ({ ...p, agentId: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите агента" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map(e => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Статус</Label>
                    <Select value={formData.status} onValueChange={value => setFormData(p => ({ ...p, status: value as DealStatus }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(statusConfig).map(([key, v]) => (
                          <SelectItem key={key} value={key}>
                            {v.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="depositDate">Дата брони</Label>
                    <Input
                      id="depositDate"
                      type="date"
                      value={formData.depositDate}
                      onChange={e => setFormData(p => ({ ...p, depositDate: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="dealDate">Дата сделки (месяц выручки)</Label>
                    <Input
                      id="dealDate"
                      type="date"
                      value={formData.dealDate}
                      onChange={e => setFormData(p => ({ ...p, dealDate: e.target.value }))}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="plannedCloseDate">Планируемая дата закрытия (для прогноза)</Label>
                    <Input
                      id="plannedCloseDate"
                      type="date"
                      value={formData.plannedCloseDate}
                      onChange={e => setFormData(p => ({ ...p, plannedCloseDate: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Тип договора</Label>
                    <Select value={formData.contractType} onValueChange={value => setFormData(p => ({ ...p, contractType: value as ContractType }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(contractTypeLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="legalServices"
                      checked={formData.legalServices}
                      onCheckedChange={checked => setFormData(p => ({ ...p, legalServices: Boolean(checked) }))}
                    />
                    <Label htmlFor="legalServices">Юридические услуги</Label>
                  </div>
                  <div>
                    <Label htmlFor="taxRate">Налог (%)</Label>
                    <Input
                      id="taxRate"
                      type="number"
                      value={formData.taxRate}
                      onChange={e => setFormData(p => ({ ...p, taxRate: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="externalExpenses">Внешние расходы</Label>
                    <Input
                      id="externalExpenses"
                      type="number"
                      value={formData.externalExpenses}
                      onChange={e => setFormData(p => ({ ...p, externalExpenses: e.target.value }))}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="notes">Примечания</Label>
                    <Textarea id="notes" value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} rows={3} />
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Отмена
                  </Button>
                  <Button onClick={() => handleCreateDeal().catch(err => alert(err.message))}>Создать</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Фильтры</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Поиск по клиенту, объекту, агенту..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Статус" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все статусы</SelectItem>
                {Object.entries(statusConfig).map(([key, v]) => (
                  <SelectItem key={key} value={key}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={agentFilter} onValueChange={setAgentFilter}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Агент" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все агенты</SelectItem>
                {employees.map(e => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Клиент</TableHead>
                  <TableHead>Объект</TableHead>
                  <TableHead>Агент</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Дата брони</TableHead>
                  <TableHead className="text-right">Комиссия</TableHead>
                  <TableHead>Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDeals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      Сделки не найдены
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDeals.map(deal => (
                    <TableRow key={deal.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium">{deal.client}</TableCell>
                      <TableCell className="max-w-xs truncate" title={deal.object}>
                        {deal.object}
                      </TableCell>
                      <TableCell>{deal.agent.name}</TableCell>
                      <TableCell>
                        <Badge className={statusConfig[deal.status].color}>{statusConfig[deal.status].label}</Badge>
                      </TableCell>
                      <TableCell>{formatDate(deal.depositDate)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(deal.commission)}</TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button variant="ghost" size="sm" onClick={() => (setSelectedDeal(deal), setIsViewDialogOpen(true))}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {isOwner && (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => setEditingDeal(deal)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDeleteDeal(deal.id).catch(err => alert(err.message))}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Просмотр сделки</DialogTitle>
          </DialogHeader>
          {selectedDeal && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Клиент</Label>
                  <p className="font-medium">{selectedDeal.client}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Агент</Label>
                  <p className="font-medium">{selectedDeal.agent.name}</p>
                </div>
                <div className="col-span-2">
                  <Label className="text-sm font-medium text-gray-500">Объект</Label>
                  <p className="font-medium">{selectedDeal.object}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Статус</Label>
                  <Badge className={statusConfig[selectedDeal.status].color}>{statusConfig[selectedDeal.status].label}</Badge>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Тип договора</Label>
                  <p className="font-medium">{contractTypeLabels[selectedDeal.contractType]}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Дата брони</Label>
                  <p className="font-medium">{formatDate(selectedDeal.depositDate)}</p>
                </div>
                {selectedDeal.dealDate && (
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Дата сделки</Label>
                    <p className="font-medium">{formatDate(selectedDeal.dealDate)}</p>
                  </div>
                )}
                {selectedDeal.plannedCloseDate && (
                  <div className="col-span-2">
                    <Label className="text-sm font-medium text-gray-500">Планируемая дата закрытия</Label>
                    <p className="font-medium">{formatDate(selectedDeal.plannedCloseDate)}</p>
                  </div>
                )}
              </div>
              <Card>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Комиссия (вал)</Label>
                      <p className="font-medium flex items-center gap-2">
                        <span>{formatCurrency(selectedDeal.commission)}</span>
                        <DollarSign className="h-4 w-4 text-gray-400" />
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Налог (%)</Label>
                      <p className="font-medium">{selectedDeal.taxRate}%</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Внешние расходы</Label>
                      <p className="font-medium">{formatCurrency(selectedDeal.externalExpenses)}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Чистая прибыль</Label>
                      <p className="font-medium">{selectedDeal.netProfit != null ? formatCurrency(selectedDeal.netProfit) : '-'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Комиссия агента</Label>
                      <p className="font-medium">{selectedDeal.agentCommission != null ? formatCurrency(selectedDeal.agentCommission) : '-'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Комиссия РОПа</Label>
                      <p className="font-medium">{selectedDeal.ropCommission != null ? formatCurrency(selectedDeal.ropCommission) : '-'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              {selectedDeal.notes && (
                <div>
                  <Label className="text-sm font-medium text-gray-500">Примечания</Label>
                  <p className="font-medium">{selectedDeal.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {isOwner && (
        <Dialog open={!!editingDeal} onOpenChange={() => setEditingDeal(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Редактирование сделки</DialogTitle>
              <DialogDescription>Комиссии считаются автоматически, но можно включить ручной режим</DialogDescription>
            </DialogHeader>
            {editingDeal && (
              <div className="grid grid-cols-2 gap-4 py-4">
              <div className="col-span-2">
                <Label>Клиент</Label>
                <Input value={editingDeal.client} onChange={e => setEditingDeal(d => (d ? { ...d, client: e.target.value } : d))} />
              </div>
              <div className="col-span-2">
                <Label>Объект</Label>
                <Input value={editingDeal.object} onChange={e => setEditingDeal(d => (d ? { ...d, object: e.target.value } : d))} />
              </div>
              <div>
                <Label>Цена</Label>
                <Input
                  type="number"
                  value={editingDeal.price}
                  onChange={e => setEditingDeal(d => (d ? { ...d, price: parseFloat(e.target.value) || 0 } : d))}
                />
              </div>
              <div>
                <Label>Комиссия (вал)</Label>
                <Input
                  type="number"
                  value={editingDeal.commission}
                  onChange={e => setEditingDeal(d => (d ? { ...d, commission: parseFloat(e.target.value) || 0 } : d))}
                />
              </div>
              <div>
                <Label>Статус</Label>
                <Select value={editingDeal.status} onValueChange={value => setEditingDeal(d => (d ? { ...d, status: value as DealStatus } : d))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusConfig).map(([key, v]) => (
                      <SelectItem key={key} value={key}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Дата брони</Label>
                <Input
                  type="date"
                  value={editingDeal.depositDate.split('T')[0]}
                  onChange={e => setEditingDeal(d => (d ? { ...d, depositDate: e.target.value } : d))}
                />
              </div>
              <div>
                <Label>Дата сделки</Label>
                <Input
                  type="date"
                  value={editingDeal.dealDate ? editingDeal.dealDate.split('T')[0] : ''}
                  onChange={e => setEditingDeal(d => (d ? { ...d, dealDate: e.target.value || null } : d))}
                />
              </div>
              <div>
                <Label>Планируемая дата закрытия</Label>
                <Input
                  type="date"
                  value={editingDeal.plannedCloseDate ? editingDeal.plannedCloseDate.split('T')[0] : ''}
                  onChange={e => setEditingDeal(d => (d ? { ...d, plannedCloseDate: e.target.value || null } : d))}
                />
              </div>
              <div>
                <Label>Тип договора</Label>
                <Select
                  value={editingDeal.contractType}
                  onValueChange={value => setEditingDeal(d => (d ? { ...d, contractType: value as ContractType } : d))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(contractTypeLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit-legalServices"
                  checked={editingDeal.legalServices}
                  onCheckedChange={checked => setEditingDeal(d => (d ? { ...d, legalServices: Boolean(checked) } : d))}
                />
                <Label htmlFor="edit-legalServices">Юридические услуги</Label>
              </div>
              <div>
                <Label>Налог (%)</Label>
                <Input
                  type="number"
                  value={editingDeal.taxRate}
                  onChange={e => setEditingDeal(d => (d ? { ...d, taxRate: parseFloat(e.target.value) || 0 } : d))}
                />
              </div>
              <div>
                <Label>Внешние расходы</Label>
                <Input
                  type="number"
                  value={editingDeal.externalExpenses}
                  onChange={e => setEditingDeal(d => (d ? { ...d, externalExpenses: parseFloat(e.target.value) || 0 } : d))}
                />
              </div>
              <div className="col-span-2 flex items-center space-x-2">
                <Checkbox
                  id="commissionsManual"
                  checked={editingDeal.commissionsManual}
                  onCheckedChange={checked => setEditingDeal(d => (d ? { ...d, commissionsManual: Boolean(checked) } : d))}
                />
                <Label htmlFor="commissionsManual">Ручной режим комиссий</Label>
              </div>
              {editingDeal.commissionsManual && (
                <>
                  <div>
                    <Label>Комиссия агента</Label>
                    <Input
                      type="number"
                      value={editingDeal.agentCommission ?? 0}
                      onChange={e =>
                        setEditingDeal(d => (d ? { ...d, agentCommission: parseFloat(e.target.value) || 0 } : d))
                      }
                    />
                  </div>
                  <div>
                    <Label>Комиссия РОПа</Label>
                    <Input
                      type="number"
                      value={editingDeal.ropCommission ?? 0}
                      onChange={e =>
                        setEditingDeal(d => (d ? { ...d, ropCommission: parseFloat(e.target.value) || 0 } : d))
                      }
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Чистая прибыль</Label>
                    <Input
                      type="number"
                      value={editingDeal.netProfit ?? 0}
                      onChange={e => setEditingDeal(d => (d ? { ...d, netProfit: parseFloat(e.target.value) || 0 } : d))}
                    />
                  </div>
                </>
              )}
              <div className="col-span-2">
                <Label>Примечания</Label>
                <Textarea value={editingDeal.notes ?? ''} onChange={e => setEditingDeal(d => (d ? { ...d, notes: e.target.value } : d))} rows={3} />
              </div>
                <div className="col-span-2 flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setEditingDeal(null)}>
                    Отмена
                  </Button>
                  <Button onClick={() => handleUpdateDeal().catch(err => alert(err.message))}>Сохранить</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

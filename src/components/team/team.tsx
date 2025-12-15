'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, RefreshCw, Edit } from 'lucide-react'

type Role = 'AGENT' | 'ROP' | 'ACCOUNTANT' | 'OWNER'
type Status = 'ACTIVE' | 'INACTIVE'

type CommissionRate = {
  id: string
  employeeId: string
  rate: number
  effectiveDate: string
  type: 'AGENT' | 'ROP'
}

type Employee = {
  id: string
  name: string
  role: Role
  status: Status
  baseRateAgent: number | null
  baseRateROP: number | null
  hireDate: string
  terminationDate: string | null
  email: string
  phone: string
  department: string | null
  managerId: string | null
  commissionRates: CommissionRate[]
}

const roleLabels: Record<Role, string> = {
  AGENT: 'Агент',
  ROP: 'РОП',
  ACCOUNTANT: 'Бухгалтер',
  OWNER: 'Владелец'
}

export function Team() {
  const NONE = '__none__'
  const [employees, setEmployees] = useState<Employee[]>([])
  const [rates, setRates] = useState<CommissionRate[]>([])
  const [loading, setLoading] = useState(true)
  const { data: session } = useSession()
  const role = ((session as any)?.role as string | undefined) ?? 'AGENT'
  const isOwner = role === 'OWNER'

  const [isEmployeeDialogOpen, setIsEmployeeDialogOpen] = useState(false)
  const [isRateDialogOpen, setIsRateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)

  const [newEmployee, setNewEmployee] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'AGENT' as Role,
    status: 'ACTIVE' as Status,
    department: '',
    hireDate: '',
    terminationDate: '',
    baseRateAgent: '',
    baseRateROP: '',
    managerId: NONE,
    password: ''
  })

  const [newRate, setNewRate] = useState({
    employeeId: '',
    type: 'AGENT' as 'AGENT' | 'ROP',
    rate: '',
    effectiveDate: ''
  })

  const [editEmployee, setEditEmployee] = useState({
    id: '',
    name: '',
    email: '',
    phone: '',
    role: 'AGENT' as Role,
    status: 'ACTIVE' as Status,
    department: '',
    hireDate: '',
    terminationDate: '',
    baseRateAgent: '',
    baseRateROP: '',
    managerId: NONE,
    password: ''
  })

  const load = async () => {
    setLoading(true)
    const [empRes, rateRes] = await Promise.all([
      fetch('/api/employees', { cache: 'no-store' }),
      fetch('/api/commission-rates', { cache: 'no-store' })
    ])
    if (!empRes.ok) throw new Error('Failed to load employees')
    if (!rateRes.ok) throw new Error('Failed to load rates')
    setEmployees(await empRes.json())
    setRates(await rateRes.json())
    setLoading(false)
  }

  useEffect(() => {
    load().catch(err => {
      console.error(err)
      setLoading(false)
    })
  }, [])

  const rops = useMemo(() => employees.filter(e => e.role === 'ROP'), [employees])

  const formatDate = (d: string) => new Date(d).toLocaleDateString('ru-RU')

  const handleAddEmployee = async () => {
    const res = await fetch('/api/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newEmployee.name,
        email: newEmployee.email,
        phone: newEmployee.phone,
        role: newEmployee.role,
        status: newEmployee.status,
        department: newEmployee.department || null,
        hireDate: newEmployee.hireDate || undefined,
        terminationDate: newEmployee.terminationDate || null,
        baseRateAgent: newEmployee.baseRateAgent ? parseFloat(newEmployee.baseRateAgent) : undefined,
        baseRateROP: newEmployee.baseRateROP ? parseFloat(newEmployee.baseRateROP) : undefined,
        managerId: newEmployee.managerId === NONE ? null : newEmployee.managerId,
        password: newEmployee.password || undefined
      })
    })
    if (!res.ok) throw new Error('Failed to create employee')
    setIsEmployeeDialogOpen(false)
    setNewEmployee({
      name: '',
      email: '',
      phone: '',
      role: 'AGENT',
      status: 'ACTIVE',
      department: '',
      hireDate: '',
      terminationDate: '',
      baseRateAgent: '',
      baseRateROP: '',
      managerId: NONE,
      password: ''
    })
    await load()
  }

  const handleAddRate = async () => {
    const res = await fetch('/api/commission-rates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeId: newRate.employeeId,
        type: newRate.type,
        rate: parseFloat(newRate.rate) || 0,
        effectiveDate: newRate.effectiveDate || undefined
      })
    })
    if (!res.ok) throw new Error('Failed to create rate')
    setIsRateDialogOpen(false)
    setNewRate({ employeeId: '', type: 'AGENT', rate: '', effectiveDate: '' })
    await load()
  }

  const openEdit = (emp: Employee) => {
    setEditingEmployee(emp)
    setEditEmployee({
      id: emp.id,
      name: emp.name,
      email: emp.email,
      phone: emp.phone,
      role: emp.role,
      status: emp.status,
      department: emp.department ?? '',
      hireDate: emp.hireDate ? emp.hireDate.slice(0, 10) : '',
      terminationDate: emp.terminationDate ? emp.terminationDate.slice(0, 10) : '',
      baseRateAgent: emp.baseRateAgent != null ? String(emp.baseRateAgent) : '',
      baseRateROP: emp.baseRateROP != null ? String(emp.baseRateROP) : '',
      managerId: emp.managerId ?? NONE,
      password: ''
    })
    setIsEditDialogOpen(true)
  }

  const handleUpdateEmployee = async () => {
    const res = await fetch(`/api/employees/${editEmployee.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editEmployee.name,
        email: editEmployee.email,
        phone: editEmployee.phone,
        role: editEmployee.role,
        status: editEmployee.status,
        department: editEmployee.department || null,
        hireDate: editEmployee.hireDate || undefined,
        terminationDate: editEmployee.terminationDate ? editEmployee.terminationDate : editEmployee.status === 'INACTIVE' ? new Date().toISOString().slice(0, 10) : null,
        baseRateAgent: editEmployee.baseRateAgent ? parseFloat(editEmployee.baseRateAgent) : null,
        baseRateROP: editEmployee.baseRateROP ? parseFloat(editEmployee.baseRateROP) : null,
        managerId: editEmployee.managerId === NONE ? null : editEmployee.managerId,
        password: editEmployee.password || undefined
      })
    })
    if (!res.ok) throw new Error('Failed to update employee')
    setIsEditDialogOpen(false)
    setEditingEmployee(null)
    setEditEmployee({
      id: '',
      name: '',
      email: '',
      phone: '',
      role: 'AGENT',
      status: 'ACTIVE',
      department: '',
      hireDate: '',
      terminationDate: '',
      baseRateAgent: '',
      baseRateROP: '',
      managerId: NONE,
      password: ''
    })
    await load()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Загрузка команды...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Команда</h2>
          <p className="text-gray-500">Сотрудники и история ставок комиссий</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => load()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Обновить
          </Button>
          {isOwner && (
            <Dialog open={isEmployeeDialogOpen} onOpenChange={setIsEmployeeDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Сотрудник
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Добавить сотрудника</DialogTitle>
                  <DialogDescription>Роли и ставки используются в расчете комиссий по сделкам</DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4 py-4">
                  <div className="col-span-2">
                    <Label>ФИО</Label>
                    <Input value={newEmployee.name} onChange={e => setNewEmployee(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input value={newEmployee.email} onChange={e => setNewEmployee(p => ({ ...p, email: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Телефон</Label>
                    <Input value={newEmployee.phone} onChange={e => setNewEmployee(p => ({ ...p, phone: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Роль</Label>
                    <Select value={newEmployee.role} onValueChange={v => setNewEmployee(p => ({ ...p, role: v as Role }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(roleLabels).map(([k, v]) => (
                          <SelectItem key={k} value={k}>
                            {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Статус</Label>
                    <Select value={newEmployee.status} onValueChange={v => setNewEmployee(p => ({ ...p, status: v as Status }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVE">Активен</SelectItem>
                        <SelectItem value="INACTIVE">Уволен</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Отдел</Label>
                    <Input value={newEmployee.department} onChange={e => setNewEmployee(p => ({ ...p, department: e.target.value }))} />
                  </div>
                  <div>
                    <Label>РОП (руководитель)</Label>
                    <Select value={newEmployee.managerId} onValueChange={v => setNewEmployee(p => ({ ...p, managerId: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Не указан" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Не указан</SelectItem>
                        {rops.map(r => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Дата найма</Label>
                    <Input
                      value={newEmployee.hireDate}
                      type="date"
                      onChange={e => setNewEmployee(p => ({ ...p, hireDate: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Дата увольнения</Label>
                    <Input
                      value={newEmployee.terminationDate}
                      type="date"
                      onChange={e => setNewEmployee(p => ({ ...p, terminationDate: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Базовая ставка агента (%)</Label>
                    <Input
                      value={newEmployee.baseRateAgent}
                      type="number"
                      onChange={e => setNewEmployee(p => ({ ...p, baseRateAgent: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Базовая ставка РОПа (%)</Label>
                    <Input
                      value={newEmployee.baseRateROP}
                      type="number"
                      onChange={e => setNewEmployee(p => ({ ...p, baseRateROP: e.target.value }))}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Пароль (для входа)</Label>
                    <Input value={newEmployee.password} type="password" onChange={e => setNewEmployee(p => ({ ...p, password: e.target.value }))} />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsEmployeeDialogOpen(false)}>
                    Отмена
                  </Button>
                  <Button onClick={() => handleAddEmployee().catch(err => alert(err.message))}>Добавить</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}

          {isOwner && (
            <Dialog open={isRateDialogOpen} onOpenChange={setIsRateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Ставка
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Добавить ставку комиссии</DialogTitle>
                  <DialogDescription>История ставок используется для корректных расчетов в прошлом</DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4 py-4">
                  <div className="col-span-2">
                    <Label>Сотрудник</Label>
                    <Select value={newRate.employeeId} onValueChange={v => setNewRate(p => ({ ...p, employeeId: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите сотрудника" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map(e => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.name} ({roleLabels[e.role]})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Тип ставки</Label>
                    <Select value={newRate.type} onValueChange={v => setNewRate(p => ({ ...p, type: v as any }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AGENT">Агент</SelectItem>
                        <SelectItem value="ROP">РОП</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Ставка (%)</Label>
                    <Input value={newRate.rate} type="number" onChange={e => setNewRate(p => ({ ...p, rate: e.target.value }))} />
                  </div>
                  <div className="col-span-2">
                    <Label>Дата вступления</Label>
                    <Input value={newRate.effectiveDate} type="date" onChange={e => setNewRate(p => ({ ...p, effectiveDate: e.target.value }))} />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsRateDialogOpen(false)}>
                    Отмена
                  </Button>
                  <Button onClick={() => handleAddRate().catch(err => alert(err.message))}>Добавить</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {isOwner && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Редактировать сотрудника</DialogTitle>
              <DialogDescription>
                Для изменения комиссии по ТЗ лучше добавлять новую запись в “История ставок” (кнопка “Ставка”)
              </DialogDescription>
            </DialogHeader>
            {editingEmployee && (
              <div className="grid grid-cols-2 gap-4 py-4">
              <div className="col-span-2">
                <Label>ФИО</Label>
                <Input value={editEmployee.name} onChange={e => setEditEmployee(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <Label>Email (логин)</Label>
                <Input value={editEmployee.email} onChange={e => setEditEmployee(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div>
                <Label>Телефон</Label>
                <Input value={editEmployee.phone} onChange={e => setEditEmployee(p => ({ ...p, phone: e.target.value }))} />
              </div>
              <div>
                <Label>Роль</Label>
                <Select value={editEmployee.role} onValueChange={v => setEditEmployee(p => ({ ...p, role: v as Role }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(roleLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Статус</Label>
                <Select value={editEmployee.status} onValueChange={v => setEditEmployee(p => ({ ...p, status: v as Status }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Активен</SelectItem>
                    <SelectItem value="INACTIVE">Уволен</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Отдел</Label>
                <Input value={editEmployee.department} onChange={e => setEditEmployee(p => ({ ...p, department: e.target.value }))} />
              </div>
              <div>
                <Label>РОП (руководитель)</Label>
                <Select value={editEmployee.managerId} onValueChange={v => setEditEmployee(p => ({ ...p, managerId: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Не указан" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Не указан</SelectItem>
                    {rops.map(r => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Дата найма</Label>
                <Input value={editEmployee.hireDate} type="date" onChange={e => setEditEmployee(p => ({ ...p, hireDate: e.target.value }))} />
              </div>
              <div>
                <Label>Дата увольнения</Label>
                <Input
                  value={editEmployee.terminationDate}
                  type="date"
                  onChange={e => setEditEmployee(p => ({ ...p, terminationDate: e.target.value }))}
                />
              </div>
              <div>
                <Label>Базовая ставка агента (%)</Label>
                <Input
                  value={editEmployee.baseRateAgent}
                  type="number"
                  onChange={e => setEditEmployee(p => ({ ...p, baseRateAgent: e.target.value }))}
                />
              </div>
              <div>
                <Label>Базовая ставка РОПа (%)</Label>
                <Input value={editEmployee.baseRateROP} type="number" onChange={e => setEditEmployee(p => ({ ...p, baseRateROP: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <Label>Новый пароль (необязательно)</Label>
                <Input value={editEmployee.password} type="password" onChange={e => setEditEmployee(p => ({ ...p, password: e.target.value }))} />
              </div>
              <div className="col-span-2 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Отмена
                </Button>
                <Button onClick={() => handleUpdateEmployee().catch(err => alert(err.message))}>Сохранить</Button>
              </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      <Tabs defaultValue="employees" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="employees">Сотрудники</TabsTrigger>
          <TabsTrigger value="rates">История ставок</TabsTrigger>
        </TabsList>

        <TabsContent value="employees">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Справочник</CardTitle>
              <CardDescription>Статус “Уволен” сохраняется для анализа текучки</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ФИО</TableHead>
                    <TableHead>Роль</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>РОП</TableHead>
                    <TableHead>Дата найма</TableHead>
                    <TableHead className="text-right">Ставка агент</TableHead>
                    <TableHead className="text-right">Ставка РОП</TableHead>
                    {isOwner && <TableHead></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map(e => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{roleLabels[e.role]}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={e.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                          {e.status === 'ACTIVE' ? 'Активен' : 'Уволен'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {e.managerId ? employees.find(x => x.id === e.managerId)?.name ?? '-' : '-'}
                      </TableCell>
                      <TableCell>{formatDate(e.hireDate)}</TableCell>
                      <TableCell className="text-right">{e.baseRateAgent != null ? `${e.baseRateAgent}%` : '-'}</TableCell>
                      <TableCell className="text-right">{e.baseRateROP != null ? `${e.baseRateROP}%` : '-'}</TableCell>
                      {isOwner && (
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(e)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rates">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">История ставок</CardTitle>
              <CardDescription>Система берет актуальную ставку на дату брони сделки</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Сотрудник</TableHead>
                    <TableHead>Тип</TableHead>
                    <TableHead className="text-right">Ставка</TableHead>
                    <TableHead>Дата</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rates.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{employees.find(e => e.id === r.employeeId)?.name ?? r.employeeId}</TableCell>
                      <TableCell>{r.type === 'AGENT' ? 'Агент' : 'РОП'}</TableCell>
                      <TableCell className="text-right">{r.rate}%</TableCell>
                      <TableCell>{formatDate(r.effectiveDate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

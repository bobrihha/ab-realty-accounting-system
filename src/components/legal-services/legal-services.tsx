'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Edit, Trash2, RefreshCw, Scale, FileText, Calculator, Users } from 'lucide-react'

type LegalService = {
    id: string
    client: string
    amount: number
    serviceDate: string
    description: string | null
}

type MonthlyStats = {
    monthKey: string
    month: string
    dealsCount: number
    dealsAmount: number
    standaloneCount: number
    standaloneAmount: number
    totalCount: number
    totalAmount: number
    lawyerSalary: number
}

type LegalServicesStats = {
    year: number
    lawyerRate: number
    months: MonthlyStats[]
    totals: {
        dealsCount: number
        dealsAmount: number
        standaloneCount: number
        standaloneAmount: number
        totalCount: number
        totalAmount: number
        lawyerSalary: number
    }
}

export function LegalServicesRegistry() {
    const { data: session } = useSession()
    const role = ((session as any)?.role as string | undefined) ?? 'AGENT'
    const isOwner = role === 'OWNER'

    const currentYear = new Date().getFullYear()
    const [selectedYear, setSelectedYear] = useState(String(currentYear))
    const [lawyerRate, setLawyerRate] = useState(60)

    const [legalServices, setLegalServices] = useState<LegalService[]>([])
    const [stats, setStats] = useState<LegalServicesStats | null>(null)
    const [loading, setLoading] = useState(true)

    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
    const [editingService, setEditingService] = useState<LegalService | null>(null)

    const [formData, setFormData] = useState({
        client: '',
        amount: '',
        serviceDate: '',
        description: ''
    })

    const loadStats = async () => {
        const statsRes = await fetch(`/api/legal-services/stats?year=${selectedYear}&lawyerRate=${lawyerRate}`, { cache: 'no-store' })
        if (statsRes.ok) {
            setStats(await statsRes.json())
        }
    }

    const load = async () => {
        setLoading(true)
        const [servicesRes] = await Promise.all([
            fetch('/api/legal-services', { cache: 'no-store' }),
            loadStats()
        ])
        if (servicesRes.ok) {
            setLegalServices(await servicesRes.json())
        }
        setLoading(false)
    }

    useEffect(() => {
        load().catch(err => {
            console.error(err)
            setLoading(false)
        })
    }, [])

    useEffect(() => {
        loadStats().catch(console.error)
    }, [selectedYear, lawyerRate])

    const resetForm = () => {
        setFormData({ client: '', amount: '', serviceDate: '', description: '' })
    }

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(amount)

    const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('ru-RU')

    const handleCreate = async () => {
        const res = await fetch('/api/legal-services', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client: formData.client,
                amount: parseFloat(formData.amount) || 0,
                serviceDate: formData.serviceDate || undefined,
                description: formData.description || undefined
            })
        })
        if (!res.ok) throw new Error('Не удалось создать юр.услугу')
        await load()
        setIsCreateDialogOpen(false)
        resetForm()
    }

    const handleUpdate = async () => {
        if (!editingService) return
        const res = await fetch(`/api/legal-services/${editingService.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client: formData.client,
                amount: parseFloat(formData.amount) || 0,
                serviceDate: formData.serviceDate || undefined,
                description: formData.description || undefined
            })
        })
        if (!res.ok) throw new Error('Не удалось обновить юр.услугу')
        await load()
        setEditingService(null)
        resetForm()
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Удалить юридическую услугу?')) return
        const res = await fetch(`/api/legal-services/${id}`, { method: 'DELETE' })
        if (!res.ok) throw new Error('Не удалось удалить юр.услугу')
        await load()
    }

    const openEdit = (service: LegalService) => {
        setEditingService(service)
        setFormData({
            client: service.client,
            amount: String(service.amount),
            serviceDate: service.serviceDate.slice(0, 10),
            description: service.description ?? ''
        })
    }

    const yearOptions = Array.from({ length: 5 }, (_, i) => String(currentYear - i))

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Загрузка юр.услуг...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Юридические услуги</h2>
                    <p className="text-gray-500">Статистика и управление юр.услугами</p>
                </div>
                <div className="flex gap-2 items-center flex-wrap">
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                        <SelectTrigger className="w-[100px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {yearOptions.map(y => (
                                <SelectItem key={y} value={y}>{y}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2">
                        <Label className="text-sm whitespace-nowrap">% юриста:</Label>
                        <Input
                            type="number"
                            className="w-[70px]"
                            value={lawyerRate}
                            onChange={e => setLawyerRate(Number(e.target.value) || 0)}
                            min={0}
                            max={100}
                        />
                    </div>
                    <Button variant="outline" onClick={() => load()}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Обновить
                    </Button>
                    {isOwner && (
                        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                            <DialogTrigger asChild>
                                <Button>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Добавить
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Новая юр.услуга</DialogTitle>
                                    <DialogDescription>Юр.услуга вне сделки</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                    <div>
                                        <Label>Клиент</Label>
                                        <Input
                                            value={formData.client}
                                            onChange={e => setFormData(p => ({ ...p, client: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <Label>Сумма (₽)</Label>
                                        <Input
                                            type="number"
                                            value={formData.amount}
                                            onChange={e => setFormData(p => ({ ...p, amount: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <Label>Дата услуги</Label>
                                        <Input
                                            type="date"
                                            value={formData.serviceDate}
                                            onChange={e => setFormData(p => ({ ...p, serviceDate: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <Label>Описание</Label>
                                        <Textarea
                                            value={formData.description}
                                            onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                                            rows={2}
                                        />
                                    </div>
                                    <div className="flex justify-end gap-2">
                                        <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                                            Отмена
                                        </Button>
                                        <Button onClick={() => handleCreate().catch(err => alert(err.message))}>
                                            Создать
                                        </Button>
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>
                    )}
                </div>
            </div>

            {/* Сводные карточки */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-blue-800 flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                Из сделок ({stats.year})
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-blue-900">{formatCurrency(stats.totals.dealsAmount)}</div>
                            <p className="text-xs text-blue-600 mt-1">{stats.totals.dealsCount} услуг</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-purple-800 flex items-center gap-2">
                                <Scale className="h-4 w-4" />
                                Отдельные ({stats.year})
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-purple-900">{formatCurrency(stats.totals.standaloneAmount)}</div>
                            <p className="text-xs text-purple-600 mt-1">{stats.totals.standaloneCount} услуг</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-green-800 flex items-center gap-2">
                                <Calculator className="h-4 w-4" />
                                Всего ({stats.year})
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-900">{formatCurrency(stats.totals.totalAmount)}</div>
                            <p className="text-xs text-green-600 mt-1">{stats.totals.totalCount} услуг</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-orange-800 flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                ЗП юриста ({lawyerRate}%)
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-orange-900">{formatCurrency(stats.totals.lawyerSalary)}</div>
                            <p className="text-xs text-orange-600 mt-1">за {stats.year} год</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Таблица по месяцам */}
            {stats && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Статистика по месяцам</CardTitle>
                        <CardDescription>Юр.услуги по дате сделки/услуги, ЗП юриста = {lawyerRate}% от суммы</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Месяц</TableHead>
                                        <TableHead className="text-right">Кол-во (сделки)</TableHead>
                                        <TableHead className="text-right">Сумма (сделки)</TableHead>
                                        <TableHead className="text-right">Кол-во (отд.)</TableHead>
                                        <TableHead className="text-right">Сумма (отд.)</TableHead>
                                        <TableHead className="text-right">Всего кол-во</TableHead>
                                        <TableHead className="text-right">Всего сумма</TableHead>
                                        <TableHead className="text-right font-bold">ЗП юриста</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {stats.months.map(m => (
                                        <TableRow key={m.monthKey}>
                                            <TableCell className="font-medium">{m.month}</TableCell>
                                            <TableCell className="text-right">{m.dealsCount || '-'}</TableCell>
                                            <TableCell className="text-right">{m.dealsAmount ? formatCurrency(m.dealsAmount) : '-'}</TableCell>
                                            <TableCell className="text-right">{m.standaloneCount || '-'}</TableCell>
                                            <TableCell className="text-right">{m.standaloneAmount ? formatCurrency(m.standaloneAmount) : '-'}</TableCell>
                                            <TableCell className="text-right font-medium">{m.totalCount || '-'}</TableCell>
                                            <TableCell className="text-right font-medium">{m.totalAmount ? formatCurrency(m.totalAmount) : '-'}</TableCell>
                                            <TableCell className="text-right font-bold text-orange-700">
                                                {m.lawyerSalary ? formatCurrency(m.lawyerSalary) : '-'}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {/* Итого */}
                                    <TableRow className="bg-gray-50 font-bold">
                                        <TableCell>Итого</TableCell>
                                        <TableCell className="text-right">{stats.totals.dealsCount}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(stats.totals.dealsAmount)}</TableCell>
                                        <TableCell className="text-right">{stats.totals.standaloneCount}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(stats.totals.standaloneAmount)}</TableCell>
                                        <TableCell className="text-right">{stats.totals.totalCount}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(stats.totals.totalAmount)}</TableCell>
                                        <TableCell className="text-right text-orange-700">{formatCurrency(stats.totals.lawyerSalary)}</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Таблица отдельных юр.услуг */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Отдельные юр.услуги</CardTitle>
                    <CardDescription>Юр.услуги, не привязанные к сделкам</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Клиент</TableHead>
                                    <TableHead>Дата</TableHead>
                                    <TableHead className="text-right">Сумма</TableHead>
                                    <TableHead>Описание</TableHead>
                                    <TableHead>Действия</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {legalServices.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                                            Нет отдельных юр.услуг
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    legalServices.map(service => (
                                        <TableRow key={service.id}>
                                            <TableCell className="font-medium">{service.client}</TableCell>
                                            <TableCell>{formatDate(service.serviceDate)}</TableCell>
                                            <TableCell className="text-right font-medium">{formatCurrency(service.amount)}</TableCell>
                                            <TableCell className="max-w-xs truncate">{service.description || '-'}</TableCell>
                                            <TableCell>
                                                <div className="flex space-x-2">
                                                    {isOwner && (
                                                        <>
                                                            <Button variant="ghost" size="sm" onClick={() => openEdit(service)}>
                                                                <Edit className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleDelete(service.id).catch(err => alert(err.message))}
                                                            >
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

            {/* Диалог редактирования */}
            {isOwner && (
                <Dialog open={!!editingService} onOpenChange={() => setEditingService(null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Редактирование юр.услуги</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div>
                                <Label>Клиент</Label>
                                <Input
                                    value={formData.client}
                                    onChange={e => setFormData(p => ({ ...p, client: e.target.value }))}
                                />
                            </div>
                            <div>
                                <Label>Сумма (₽)</Label>
                                <Input
                                    type="number"
                                    value={formData.amount}
                                    onChange={e => setFormData(p => ({ ...p, amount: e.target.value }))}
                                />
                            </div>
                            <div>
                                <Label>Дата услуги</Label>
                                <Input
                                    type="date"
                                    value={formData.serviceDate}
                                    onChange={e => setFormData(p => ({ ...p, serviceDate: e.target.value }))}
                                />
                            </div>
                            <div>
                                <Label>Описание</Label>
                                <Textarea
                                    value={formData.description}
                                    onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                                    rows={2}
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setEditingService(null)}>
                                    Отмена
                                </Button>
                                <Button onClick={() => handleUpdate().catch(err => alert(err.message))}>
                                    Сохранить
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    )
}

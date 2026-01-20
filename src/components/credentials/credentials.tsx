'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Search, Edit, Trash2, Copy, Eye, EyeOff, Globe, Lock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

type Credential = {
    id: string
    title: string
    category: string
    url: string | null
    login: string | null
    password: string | null
    description: string | null
    updatedAt: string
}

const CATEGORIES = ['Маркетинг', 'Админ', 'Юрист', 'Найм', 'IT', 'Другое']

export function CredentialsRegistry() {
    const [credentials, setCredentials] = useState<Credential[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [categoryFilter, setCategoryFilter] = useState('all')
    const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({})

    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingItem, setEditingItem] = useState<Credential | null>(null)

    const [formData, setFormData] = useState({
        title: '',
        category: '',
        url: '',
        login: '',
        password: '',
        description: ''
    })

    useEffect(() => {
        load()
    }, [])

    const load = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/credentials')
            if (res.ok) {
                setCredentials(await res.json())
            }
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const resetForm = () => {
        setFormData({
            title: '',
            category: '',
            url: '',
            login: '',
            password: '',
            description: ''
        })
        setEditingItem(null)
    }

    const handleSave = async () => {
        try {
            if (editingItem) {
                await fetch(`/api/credentials/${editingItem.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                })
            } else {
                await fetch('/api/credentials', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                })
            }
            setIsDialogOpen(false)
            resetForm()
            load()
        } catch (error) {
            alert('Ошибка при сохранении')
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Удалить этот доступ?')) return
        await fetch(`/api/credentials/${id}`, { method: 'DELETE' })
        load()
    }

    const togglePasswordVisibility = (id: string) => {
        setVisiblePasswords(prev => ({
            ...prev,
            [id]: !prev[id]
        }))
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
        // Можно добавить тост-уведомление
    }

    const openEdit = (item: Credential) => {
        setEditingItem(item)
        setFormData({
            title: item.title,
            category: item.category,
            url: item.url || '',
            login: item.login || '',
            password: item.password || '',
            description: item.description || ''
        })
        setIsDialogOpen(true)
    }

    const filteredCredentials = credentials.filter(item => {
        const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.description?.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter
        return matchesSearch && matchesCategory
    })

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Доступы и пароли</h2>
                    <p className="text-gray-500">Безопасное хранение доступов к сервисам</p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="h-4 w-4 mr-2" />
                            Добавить доступ
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editingItem ? 'Редактирование доступа' : 'Новый доступ'}</DialogTitle>
                            <DialogDescription>
                                Сохраните логин и пароль для сервиса
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-2">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Название сервиса</Label>
                                    <Input
                                        placeholder="Например, Авито"
                                        value={formData.title}
                                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Категория</Label>
                                    <Select
                                        value={formData.category}
                                        onValueChange={v => setFormData({ ...formData, category: v })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Выберите..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {CATEGORIES.map(c => (
                                                <SelectItem key={c} value={c}>{c}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Ссылка на вход (URL)</Label>
                                <Input
                                    placeholder="https://..."
                                    value={formData.url}
                                    onChange={e => setFormData({ ...formData, url: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Логин (Email/Телефон)</Label>
                                    <Input
                                        value={formData.login}
                                        onChange={e => setFormData({ ...formData, login: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Пароль</Label>
                                    <div className="relative">
                                        <Input
                                            value={formData.password}
                                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Примечание</Label>
                                <Input
                                    placeholder="Доп. инфо..."
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-4">
                                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Отмена</Button>
                                <Button onClick={handleSave}>Сохранить</Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <div className="flex justify-between items-center flex-wrap gap-4">
                        <div className="flex items-center gap-2 flex-1 min-w-[300px]">
                            <Search className="h-4 w-4 text-gray-500" />
                            <Input
                                placeholder="Поиск по названию..."
                                className="max-w-sm"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2">
                            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Все разделы" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Все разделы</SelectItem>
                                    {CATEGORIES.map(c => (
                                        <SelectItem key={c} value={c}>{c}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Сервис</TableHead>
                                    <TableHead>Раздел</TableHead>
                                    <TableHead>Ссылка</TableHead>
                                    <TableHead>Логин</TableHead>
                                    <TableHead>Пароль</TableHead>
                                    <TableHead className="w-[100px]">Действия</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredCredentials.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                                            Нет записей
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredCredentials.map(item => (
                                        <TableRow key={item.id} className="hover:bg-gray-50">
                                            <TableCell className="font-medium">
                                                <div className="flex flex-col">
                                                    <span>{item.title}</span>
                                                    {item.description && (
                                                        <span className="text-xs text-gray-500">{item.description}</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className="font-normal text-xs">
                                                    {item.category}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {item.url ? (
                                                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 flex items-center gap-1 group">
                                                        <Globe className="h-3 w-3" />
                                                        Сайт
                                                    </a>
                                                ) : '-'}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2 max-w-[200px]">
                                                    <span className="truncate text-sm">{item.login || '-'}</span>
                                                    {item.login && (
                                                        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-30 group-hover:opacity-100" onClick={() => copyToClipboard(item.login!)}>
                                                            <Copy className="h-3 w-3" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <code className="bg-gray-100 rounded px-1 py-0.5 text-sm">
                                                        {visiblePasswords[item.id] ? item.password : '••••••••'}
                                                    </code>
                                                    {item.password && (
                                                        <>
                                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => togglePasswordVisibility(item.id)}>
                                                                {visiblePasswords[item.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(item.password!)}>
                                                                <Copy className="h-3 w-3" />
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex gap-1">
                                                    <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600" onClick={() => handleDelete(item.id)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
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
        </div>
    )
}

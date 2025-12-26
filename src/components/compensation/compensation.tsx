'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type Deal = {
  id: string
  client: string
  object: string
  commission: number
  agentCommission: number | null
  ropCommission: number | null
  dealDate?: string | null
  plannedCloseDate?: string | null
}

type Payload = {
  role: 'AGENT' | 'ROP'
  month: string
  earned: number
  expected: number
  earnedDeals: Deal[]
  pipelineDeals: Deal[]
}

export function Compensation() {
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/compensation', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setData(d))
      .finally(() => setLoading(false))
  }, [])

  const fmt = (n: number) =>
    new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(n)

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

  if (!data || (data as any).error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Комиссии</CardTitle>
          <CardDescription>Нет доступа или нет данных</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const field = data.role === 'AGENT' ? 'agentCommission' : 'ropCommission'

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Заработано за {data.month}</CardTitle>
            <CardDescription>Сумма комиссий по сделкам с датой сделки</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{fmt(data.earned)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Ожидаю</CardTitle>
            <CardDescription>Прогноз по сделкам в работе</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{fmt(data.expected)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Сделки в работе</CardTitle>
          <CardDescription>Ожидаемые комиссии</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Клиент</TableHead>
                <TableHead>Объект</TableHead>
                <TableHead className="text-right">Комиссия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.pipelineDeals.map(d => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.client}</TableCell>
                  <TableCell className="max-w-xs truncate" title={d.object}>
                    {d.object}
                  </TableCell>
                  <TableCell className="text-right">{fmt(Number((d as any)[field]) || 0)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}


'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Deal } from '@/app/page'
import { Calendar, User, Home, DollarSign, Edit, Trash2 } from 'lucide-react'

interface DealCardProps {
  deal: Deal
  onUpdate?: (deal: Deal) => void
  onDelete?: (dealId: string) => void
}

export function DealCard({ deal, onUpdate, onDelete }: DealCardProps) {
  const [isEditOpen, setIsEditOpen] = useState(false)

  const getStatusBadge = (status: Deal['status']) => {
    const statusConfig = {
      deposit: { label: 'Задаток', variant: 'secondary' as const },
      registration: { label: 'На регистрации', variant: 'default' as const },
      waiting_payment: { label: 'На оплате', variant: 'outline' as const },
      closed: { label: 'Закрыта', variant: 'default' as const },
      cancelled: { label: 'Срыв', variant: 'destructive' as const }
    }
    return statusConfig[status]
  }

  const getStatusColor = (status: Deal['status']) => {
    const colors = {
      deposit: 'bg-orange-50 border-orange-200 hover:bg-orange-100',
      registration: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
      waiting_payment: 'bg-green-50 border-green-200 hover:bg-green-100',
      closed: 'bg-gray-50 border-gray-200 hover:bg-gray-100',
      cancelled: 'bg-red-50 border-red-200 hover:bg-red-100'
    }
    return colors[status]
  }

  const statusBadge = getStatusBadge(deal.status)
  const statusColor = getStatusColor(deal.status)

  return (
    <>
      <Card className={`transition-all cursor-pointer ${statusColor}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-gray-500" />
                <CardTitle className="text-lg">{deal.client}</CardTitle>
              </div>
              <Badge variant={statusBadge.variant}>
                {statusBadge.label}
              </Badge>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsEditOpen(true)
                }}
              >
                <Edit className="h-4 w-4" />
              </Button>
              {onDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(deal.id)
                  }}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Home className="h-4 w-4" />
              <span>{deal.object}</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center space-x-2">
                <DollarSign className="h-4 w-4 text-gray-500" />
                <span className="font-medium">Цена:</span>
                <span>₽ {deal.price.toLocaleString('ru-RU')}</span>
              </div>
              <div className="flex items-center space-x-2">
                <DollarSign className="h-4 w-4 text-gray-500" />
                <span className="font-medium">Комиссия:</span>
                <span>₽ {deal.commission.toLocaleString('ru-RU')}</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm text-gray-500 pt-2 border-t">
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4" />
                <span>Агент: {deal.agent}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4" />
                <span>Бронь: {new Date(deal.depositDate).toLocaleDateString('ru-RU')}</span>
              </div>
            </div>

            {deal.dealDate && (
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <Calendar className="h-4 w-4" />
                <span>Сделка: {new Date(deal.dealDate).toLocaleDateString('ru-RU')}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Редактирование сделки</DialogTitle>
            <DialogDescription>
              Измените информацию о сделке
            </DialogDescription>
          </DialogHeader>
          <div className="text-center py-8 text-gray-500">
            <Edit className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>Форма редактирования в разработке</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
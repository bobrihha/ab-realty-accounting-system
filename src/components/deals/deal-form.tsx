'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { cn } from '@/lib/utils'

interface DealFormProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (deal: any) => void
}

const agents = [
  'Петров А.С.',
  'Сидорова К.В.',
  'Иванова М.А.',
  'Козлов Д.П.'
]

const contractTypes = [
  { value: 'exclusive', label: 'Эксклюзив' },
  { value: 'selection', label: 'Подбор' },
  { value: 'developer', label: 'Застройщик' }
]

export function DealForm({ isOpen, onClose, onSubmit }: DealFormProps) {
  const [formData, setFormData] = useState({
    client: '',
    object: '',
    price: '',
    commission: '',
    agentRateApplied: '',
    ropRateApplied: '',
    legalServicesAmount: '',
    agent: '',
    status: 'deposit' as const,
    depositDate: new Date(),
    dealDate: undefined as Date | undefined,
    contractType: '',
    legalServices: false,
    notes: ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const deal = {
      id: Date.now().toString(),
      client: formData.client,
      object: formData.object,
      price: parseFloat(formData.price) || 0,
      commission: parseFloat(formData.commission) || 0,
      agentRateApplied: formData.agentRateApplied.trim() === '' ? undefined : parseFloat(formData.agentRateApplied),
      ropRateApplied: formData.ropRateApplied.trim() === '' ? undefined : parseFloat(formData.ropRateApplied),
      legalServicesAmount: formData.legalServices ? parseFloat(formData.legalServicesAmount) || 0 : 0,
      agent: formData.agent,
      status: formData.status,
      depositDate: formData.depositDate.toISOString(),
      dealDate: formData.dealDate?.toISOString(),
      contractType: formData.contractType,
      legalServices: formData.legalServices,
      notes: formData.notes
    }

    onSubmit(deal)
    onClose()
    
    // Reset form
    setFormData({
      client: '',
      object: '',
      price: '',
      commission: '',
      agentRateApplied: '',
      ropRateApplied: '',
      legalServicesAmount: '',
      agent: '',
      status: 'deposit',
      depositDate: new Date(),
      dealDate: undefined,
      contractType: '',
      legalServices: false,
      notes: ''
    })
  }

  const calculateCommission = () => {
    const price = parseFloat(formData.price) || 0
    const commissionRate = 0.03 // 3% стандартная комиссия
    const calculatedCommission = price * commissionRate
    setFormData(prev => ({
      ...prev,
      commission: calculatedCommission.toString()
    }))
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Новая сделка</DialogTitle>
          <DialogDescription>
            Заполните информацию о новой сделке
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Основная информация */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Основная информация</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="client">Клиент</Label>
                <Input
                  id="client"
                  value={formData.client}
                  onChange={(e) => setFormData(prev => ({ ...prev, client: e.target.value }))}
                  placeholder="ФИО клиента"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="agent">Ответственный агент</Label>
                <Select value={formData.agent} onValueChange={(value) => setFormData(prev => ({ ...prev, agent: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите агента" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((agent) => (
                      <SelectItem key={agent} value={agent}>
                        {agent}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="object">Объект</Label>
              <Textarea
                id="object"
                value={formData.object}
                onChange={(e) => setFormData(prev => ({ ...prev, object: e.target.value }))}
                placeholder="Описание объекта недвижимости"
                rows={2}
                required
              />
            </div>
          </div>

          {/* Финансовая информация */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Финансовая информация</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="price">Цена объекта (₽)</Label>
                <Input
                  id="price"
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                  placeholder="0"
                  onBlur={calculateCommission}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="commission">Комиссия агентства (₽)</Label>
                <Input
                  id="commission"
                  type="number"
                  value={formData.commission}
                  onChange={(e) => setFormData(prev => ({ ...prev, commission: e.target.value }))}
                  placeholder="0"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="agentRateApplied">Ставка агента (%)</Label>
                <Input
                  id="agentRateApplied"
                  type="number"
                  value={formData.agentRateApplied}
                  onChange={(e) => setFormData(prev => ({ ...prev, agentRateApplied: e.target.value }))}
                  placeholder="по умолчанию"
                />
              </div>
              <div>
                <Label htmlFor="ropRateApplied">Ставка РОПа (%)</Label>
                <Input
                  id="ropRateApplied"
                  type="number"
                  value={formData.ropRateApplied}
                  onChange={(e) => setFormData(prev => ({ ...prev, ropRateApplied: e.target.value }))}
                  placeholder="по умолчанию"
                />
              </div>
              <div>
                <Label htmlFor="contractType">Тип договора</Label>
                <Select value={formData.contractType} onValueChange={(value) => setFormData(prev => ({ ...prev, contractType: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите тип" />
                  </SelectTrigger>
                  <SelectContent>
                    {contractTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2 pt-6">
                <input
                  type="checkbox"
                  id="legalServices"
                  checked={formData.legalServices}
                  onChange={(e) =>
                    setFormData(prev => ({
                      ...prev,
                      legalServices: e.target.checked,
                      legalServicesAmount: e.target.checked ? prev.legalServicesAmount : ''
                    }))
                  }
                  className="rounded"
                />
                <Label htmlFor="legalServices">Юридические услуги</Label>
              </div>
            </div>
            {formData.legalServices && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="legalServicesAmount">Стоимость юр. услуг (₽)</Label>
                  <Input
                    id="legalServicesAmount"
                    type="number"
                    value={formData.legalServicesAmount}
                    onChange={(e) => setFormData(prev => ({ ...prev, legalServicesAmount: e.target.value }))}
                    placeholder="0"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Даты и статус */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Даты и статус</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Дата брони</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.depositDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.depositDate ? (
                        format(formData.depositDate, "PPP", { locale: ru })
                      ) : (
                        <span>Выберите дату</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.depositDate}
                      onSelect={(date) => date && setFormData(prev => ({ ...prev, depositDate: date }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label>Дата сделки</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.dealDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.dealDate ? (
                        format(formData.dealDate, "PPP", { locale: ru })
                      ) : (
                        <span>Выберите дату</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.dealDate}
                      onSelect={(date) => setFormData(prev => ({ ...prev, dealDate: date }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div>
              <Label htmlFor="status">Статус сделки</Label>
              <Select value={formData.status} onValueChange={(value: any) => setFormData(prev => ({ ...prev, status: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deposit">Задаток</SelectItem>
                  <SelectItem value="registration">На регистрации</SelectItem>
                  <SelectItem value="waiting_payment">На оплате</SelectItem>
                  <SelectItem value="closed">Закрыта</SelectItem>
                  <SelectItem value="cancelled">Срыв</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Примечания */}
          <div>
            <Label htmlFor="notes">Примечания</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Дополнительная информация о сделке"
              rows={3}
            />
          </div>

          {/* Кнопки действий */}
          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit">
              Создать сделку
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

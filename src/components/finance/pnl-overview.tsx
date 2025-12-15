'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TrendingUp, TrendingDown, DollarSign, Target, AlertTriangle } from 'lucide-react'

interface FinanceMetrics {
  month: string
  revenue: number
  expenses: number
  profit: number
  profitMargin: number
  dealsCount: number
}

interface PnLOverviewProps {
  data: FinanceMetrics[]
  currentMonth: string
}

export function PnLOverview({ data, currentMonth }: PnLOverviewProps) {
  const currentMonthData = data.find(item => item.month === currentMonth)
  const previousMonthData = data[data.findIndex(item => item.month === currentMonth) - 1]
  
  if (!currentMonthData) {
    return (
      <div className="text-center py-8 text-gray-500">
        <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
        <p>Данные за текущий месяц отсутствуют</p>
      </div>
    )
  }

  const calculateChange = (current: number, previous?: number) => {
    if (!previous || previous === 0) return 0
    return ((current - previous) / previous) * 100
  }

  const revenueChange = calculateChange(currentMonthData.revenue, previousMonthData?.revenue)
  const profitChange = calculateChange(currentMonthData.profit, previousMonthData?.profit)
  const marginChange = calculateChange(currentMonthData.profitMargin, previousMonthData?.profitMargin)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Выручка</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(currentMonthData.revenue)}</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              {revenueChange !== 0 && (
                <>
                  <span className={revenueChange > 0 ? 'text-green-600' : 'text-red-600'}>
                    {revenueChange > 0 ? '↑' : '↓'} {Math.abs(revenueChange).toFixed(1)}%
                  </span>
                  <span>к прошлому месяцу</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Расходы</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(currentMonthData.expenses)}</div>
            <p className="text-xs text-muted-foreground">
              {((currentMonthData.expenses / currentMonthData.revenue) * 100).toFixed(1)}% от выручки
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Чистая прибыль</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(currentMonthData.profit)}</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              {profitChange !== 0 && (
                <>
                  <span className={profitChange > 0 ? 'text-green-600' : 'text-red-600'}>
                    {profitChange > 0 ? '↑' : '↓'} {Math.abs(profitChange).toFixed(1)}%
                  </span>
                  <span>к прошлому месяцу</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Рентабельность</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentMonthData.profitMargin.toFixed(1)}%</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              {marginChange !== 0 && (
                <>
                  <span className={marginChange > 0 ? 'text-green-600' : 'text-red-600'}>
                    {marginChange > 0 ? '↑' : '↓'} {Math.abs(marginChange).toFixed(1)}%
                  </span>
                  <span>к прошлому месяцу</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Сводка за {currentMonthData.month}</CardTitle>
          <CardDescription>
            Ключевые финансовые показатели и метрики эффективности
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-3xl font-bold text-blue-600">{currentMonthData.dealsCount}</div>
              <p className="text-sm text-blue-600 mt-2">Закрыто сделок</p>
              <p className="text-xs text-blue-500 mt-1">
                Средний чек: {formatCurrency(currentMonthData.revenue / currentMonthData.dealsCount)}
              </p>
            </div>
            
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-3xl font-bold text-green-600">{formatCurrency(currentMonthData.profit)}</div>
              <p className="text-sm text-green-600 mt-2">Чистая прибыль</p>
              <p className="text-xs text-green-500 mt-1">
                На сделку: {formatCurrency(currentMonthData.profit / currentMonthData.dealsCount)}
              </p>
            </div>
            
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-3xl font-bold text-purple-600">{currentMonthData.profitMargin.toFixed(1)}%</div>
              <p className="text-sm text-purple-600 mt-2">Рентабельность</p>
              <Badge 
                variant={currentMonthData.profitMargin >= 20 ? "default" : "secondary"}
                className="mt-2"
              >
                {currentMonthData.profitMargin >= 20 ? "Отлично" : currentMonthData.profitMargin >= 10 ? "Хорошо" : "Требует внимания"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
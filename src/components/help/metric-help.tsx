'use client'

import { ReactNode } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'

type MetricHelpProps = {
  title: string
  summary: ReactNode
  details: ReactNode
  trigger: ReactNode
  description?: string
}

export function MetricHelp({ title, summary, details, trigger, description }: MetricHelpProps) {
  return (
    <Dialog>
      <HoverCard openDelay={250}>
        <HoverCardTrigger asChild>
          <DialogTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center justify-center cursor-help"
              aria-label={`Как считается: ${title}`}
            >
              {trigger}
            </button>
          </DialogTrigger>
        </HoverCardTrigger>
        <HoverCardContent className="w-80">
          <div className="text-sm font-medium">{title}</div>
          <div className="mt-2 text-sm text-muted-foreground">{summary}</div>
          <div className="mt-2 text-xs text-muted-foreground">Кликните, чтобы открыть подробное описание.</div>
        </HoverCardContent>
      </HoverCard>

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-3 text-sm">{details}</div>
      </DialogContent>
    </Dialog>
  )
}


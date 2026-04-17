'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatDate } from '@/src/lib/dates'

interface DatePickerProps {
  value: string // YYYY-MM-DD
}

export default function DatePicker({ value }: DatePickerProps) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)

  // Parse YYYY-MM-DD as local date (avoid UTC offset shifting the day)
  const [year, month, day] = value.split('-').map(Number)
  const selected = new Date(year, month - 1, day)

  function handleSelect(date: Date | undefined) {
    if (!date) return
    const yyyy = date.getFullYear()
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    router.push(`/dashboard?date=${yyyy}-${mm}-${dd}`)
    router.refresh()
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger>
        <div className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
          <CalendarIcon className="size-4" />
          {formatDate(selected)}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={handleSelect}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}

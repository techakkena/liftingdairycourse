import { format, getDate } from "date-fns"

function ordinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return `${day}th`
  switch (day % 10) {
    case 1: return `${day}st`
    case 2: return `${day}nd`
    case 3: return `${day}rd`
    default: return `${day}th`
  }
}

export function formatDate(date: Date | string | number): string {
  const d = new Date(date)
  return `${ordinalSuffix(getDate(d))} ${format(d, "MMM yyyy")}`
}

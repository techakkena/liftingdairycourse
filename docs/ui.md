# UI Coding Standards

## Component Library — shadcn/ui (Required)

**All UI must be built exclusively with shadcn/ui components.**

- **No custom components** — do not create bespoke UI components. If shadcn/ui does not have what you need, find the closest shadcn/ui primitive and compose from it.
- Add components via the CLI: `npx shadcn add <component>`
- Components are installed to `src/components/ui/` and can be imported via `@/components/ui/<component>`
- The project uses the `base-nova` style with `neutral` base color and CSS variables. Do not change these.
- Icons use the `lucide-react` library (already installed). Do not add other icon libraries.

### Configuration

`components.json` is the source of truth for shadcn/ui settings. Do not edit it manually.

```json
{
  "style": "base-nova",
  "tailwind": { "baseColor": "neutral", "cssVariables": true },
  "iconLibrary": "lucide",
  "aliases": { "ui": "@/components/ui" }
}
```

### Adding a Component

```bash
npx shadcn add button
npx shadcn add card
npx shadcn add input
# etc.
```

### Importing Components

```tsx
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
```

---

## Date Formatting — date-fns (Required)

**All date formatting must use `date-fns`.** Do not use `Date.prototype.toLocaleDateString`, `Intl.DateTimeFormat`, or any other date formatting approach.

Install if not present:

```bash
npm install date-fns
```

### Required Format

Dates must display with an ordinal day suffix, abbreviated month, and full year:

```
1st Sep 2025
2nd Aug 2025
3rd Jan 2026
4th Jun 2024
```

### Implementation

Use `format` together with `getDate` to produce the ordinal suffix:

```ts
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
```

Usage:

```tsx
import { formatDate } from "@/lib/dates"

<span>{formatDate(new Date("2025-09-01"))}</span>  // → "1st Sep 2025"
<span>{formatDate(new Date("2026-01-03"))}</span>  // → "3rd Jan 2026"
```

Place the `formatDate` utility in `src/lib/dates.ts`.

---

## Summary

| Concern        | Required Tool      | Prohibited                              |
|----------------|--------------------|-----------------------------------------|
| UI components  | shadcn/ui only     | Custom components, other UI libraries   |
| Icons          | lucide-react only  | Other icon libraries                    |
| Date formatting| date-fns only      | `toLocaleDateString`, `Intl`, manual    |

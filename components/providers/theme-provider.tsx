"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { useServerInsertedHTML } from "next/navigation"

type Theme = "light" | "dark" | "system"

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  setTheme: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "theme",
}: {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}) {
  // Inject the FOUC-prevention script into the raw streaming HTML output —
  // outside React's virtual DOM tree, so React 19 never warns about it.
  useServerInsertedHTML(() => (
    <script
      id="theme-init"
      dangerouslySetInnerHTML={{
        __html: `(function(){try{var t=localStorage.getItem('${storageKey}')||'${defaultTheme}';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark')}catch(e){}}())`,
      }}
    />
  ))

  const [theme, setThemeState] = useState<Theme>(defaultTheme)

  // Read persisted theme on mount
  useEffect(() => {
    const stored = localStorage.getItem(storageKey) as Theme | null
    if (stored) setThemeState(stored)
  }, [storageKey])

  // Apply dark class and persist whenever theme changes
  useEffect(() => {
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    const isDark = theme === "dark" || (theme === "system" && systemDark)
    document.documentElement.classList.toggle("dark", isDark)
    localStorage.setItem(storageKey, theme)
  }, [theme, storageKey])

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setThemeState }}>
      {children}
    </ThemeContext.Provider>
  )
}

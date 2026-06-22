import { createContext, useContext, useEffect, useState, useCallback } from "react"

export type Theme = "dark" | "light" | "system"

type ThemeProviderProps = {
    children: React.ReactNode
    defaultTheme?: Theme
    storageKey?: string
}

type ThemeProviderState = {
    theme: "light" | "dark"
    themeSetting: Theme
    setTheme: (theme: Theme) => void
}

const initialState: ThemeProviderState = {
    theme: "light",
    themeSetting: "system",
    setTheme: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
    children,
    defaultTheme = "light",
    storageKey = "vite-ui-theme",
    ...props
}: ThemeProviderProps) {
    const [themeSetting, setThemeSetting] = useState<Theme>(
        () => (sessionStorage.getItem(storageKey) as Theme) || defaultTheme
    )

    const getSystemTheme = useCallback(() => {
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
    }, [])

    const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(
        themeSetting === "system" ? getSystemTheme() : (themeSetting as "light" | "dark")
    )

    // 1. Resolve theme and listen for system changes
    useEffect(() => {
        if (themeSetting === "system") {
            const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
            const handleChange = () => {
                setResolvedTheme(mediaQuery.matches ? "dark" : "light")
            }

            setResolvedTheme(getSystemTheme())
            mediaQuery.addEventListener("change", handleChange)
            return () => mediaQuery.removeEventListener("change", handleChange)
        } else {
            setResolvedTheme(themeSetting as "light" | "dark")
        }
    }, [themeSetting, getSystemTheme])

    // 2. Sync DOM class with resolved theme
    useEffect(() => {
        const root = window.document.documentElement
        root.classList.remove("light", "dark")
        root.classList.add(resolvedTheme)
    }, [resolvedTheme])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement
            if (
                target.tagName === "INPUT" ||
                target.tagName === "TEXTAREA" ||
                target.isContentEditable
            ) {
                return
            }

            if (e.key.toLowerCase() === "d") {
                const newTheme = resolvedTheme === "dark" ? "light" : "dark"
                sessionStorage.setItem(storageKey, newTheme)
                setThemeSetting(newTheme)
            }
        }

        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [resolvedTheme, storageKey])

    const value = {
        theme: resolvedTheme,
        themeSetting,
        setTheme: (theme: Theme) => {
            sessionStorage.setItem(storageKey, theme)
            setThemeSetting(theme)
        },
    }

    return (
        <ThemeProviderContext.Provider {...props} value={value}>
            {children}
        </ThemeProviderContext.Provider>
    )
}

export const useTheme = () => {
    const context = useContext(ThemeProviderContext)

    if (context === undefined)
        throw new Error("useTheme must be used within a ThemeProvider")

    return context
}
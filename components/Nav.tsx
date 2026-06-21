"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const tabs = [
  {
    label: "Plan",
    href: "/",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
  },
  {
    label: "Recipes",
    href: "/recipes",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
      </svg>
    ),
  },
  {
    label: "Shopping",
    href: "/shopping",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
      </svg>
    ),
  },
  {
    label: "Favourites",
    href: "/favourites",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
      </svg>
    ),
  },
  {
    label: "Suggest",
    href: "/suggestions",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
      </svg>
    ),
  },
]

export function Nav() {
  const pathname = usePathname()

  function isActive(href: string) {
    if (href === "/") return pathname === "/"
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* Desktop top nav */}
      <nav className="hidden md:block bg-white/80 backdrop-blur-sm border-b border-meal-warm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo-icon.svg" alt="" className="h-8 w-auto" />
            <span className="text-lg font-bold text-meal-charcoal tracking-tight">
              <span className="text-meal-muted font-normal text-xs uppercase tracking-widest block -mb-1">The Breslin</span>
              Fork <span className="text-meal-sage">&amp;</span> <span className="text-meal-coral">Spoon</span>
            </span>
          </Link>
          <div className="flex items-center gap-1">
            {tabs.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive(tab.href)
                    ? "bg-meal-sage text-white"
                    : "text-meal-muted hover:text-meal-charcoal hover:bg-meal-warm"
                }`}
              >
                {tab.icon}
                {tab.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      {/* Mobile top logo */}
      <div className="md:hidden bg-white/80 backdrop-blur-sm border-b border-meal-warm sticky top-0 z-50 px-4 py-2.5 flex items-center justify-center gap-2">
        <img src="/logo-icon.svg" alt="" className="h-7 w-auto" />
        <span className="text-base font-bold text-meal-charcoal tracking-tight">
          <span className="text-meal-muted font-normal text-[9px] uppercase tracking-widest block -mb-0.5">The Breslin</span>
          Fork <span className="text-meal-sage">&amp;</span> <span className="text-meal-coral">Spoon</span>
        </span>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-meal-warm z-50 pb-safe">
        <div className="flex justify-around items-center h-16">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center justify-center gap-0.5 w-full py-1 transition-colors ${
                isActive(tab.href) ? "text-meal-sage" : "text-meal-muted"
              }`}
            >
              {tab.icon}
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  )
}

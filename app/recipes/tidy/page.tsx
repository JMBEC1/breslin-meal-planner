"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface Suggestion {
  id: number
  current: string
  suggested: string
  changed: boolean
}

export default function TidyTitlesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [rows, setRows] = useState<Suggestion[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [showUnchanged, setShowUnchanged] = useState(false)
  const [applying, setApplying] = useState(false)
  const [done, setDone] = useState<{ accepted: number; skipped: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      setError("")
      try {
        const res = await fetch("/api/recipes/tidy/suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? "Failed to load suggestions")
        if (cancelled) return
        const suggestions: Suggestion[] = data.suggestions ?? []
        setRows(suggestions)
        // Default selection: all changed rows
        setSelected(new Set(suggestions.filter((s) => s.changed).map((s) => s.id)))
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Unknown error")
      }
      if (!cancelled) setLoading(false)
    }
    run()
    return () => { cancelled = true }
  }, [])

  function toggleRow(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAllChanged() {
    setSelected(new Set(rows.filter((r) => r.changed).map((r) => r.id)))
  }

  function clearSelection() {
    setSelected(new Set())
  }

  function updateSuggested(id: number, value: string) {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, suggested: value, changed: value.trim().toLowerCase() !== r.current.trim().toLowerCase() } : r))
  }

  async function applySelected() {
    setApplying(true)
    setError("")
    let accepted = 0
    const toApply = rows.filter((r) => selected.has(r.id) && r.suggested.trim() && r.suggested.trim() !== r.current.trim())
    try {
      await Promise.all(
        toApply.map(async (r) => {
          const res = await fetch(`/api/recipes/${r.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: r.suggested.trim() }),
          })
          if (res.ok) accepted++
        })
      )
      setDone({ accepted, skipped: rows.length - accepted })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to apply")
    }
    setApplying(false)
  }

  const visibleRows = showUnchanged ? rows : rows.filter((r) => r.changed)
  const changedCount = rows.filter((r) => r.changed).length

  if (done) {
    return (
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-12 text-center">
        <h1 className="text-2xl font-bold text-meal-charcoal mb-2">All tidied ✓</h1>
        <p className="text-meal-muted mb-6">Updated {done.accepted} recipe{done.accepted === 1 ? "" : "s"}.</p>
        <div className="flex gap-2 justify-center">
          <button
            onClick={() => router.push("/recipes")}
            className="px-4 py-2 rounded-lg bg-meal-sage text-white text-sm font-medium hover:bg-meal-sageHover"
          >
            Back to recipes
          </button>
          <button
            onClick={() => { setDone(null); setRows([]); setSelected(new Set()); router.refresh() }}
            className="px-4 py-2 rounded-lg bg-meal-warm text-meal-charcoal text-sm font-medium"
          >
            Run again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-meal-charcoal">Tidy recipe titles</h1>
          <p className="text-xs text-meal-muted mt-0.5">AI-suggested clean titles. Edit each one if you want, then accept the ones you like.</p>
        </div>
        <Link href="/recipes" className="text-sm text-meal-muted hover:text-meal-charcoal">Cancel</Link>
      </div>

      {loading && (
        <div className="text-center py-12 text-meal-muted">
          Loading suggestions... this takes ~2-5 seconds.
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && rows.length > 0 && (
        <>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <button onClick={selectAllChanged} className="text-xs px-3 py-1.5 rounded-lg bg-meal-warm text-meal-charcoal hover:bg-meal-warm/80">
              Select all changed ({changedCount})
            </button>
            <button onClick={clearSelection} className="text-xs px-3 py-1.5 rounded-lg bg-meal-warm text-meal-charcoal hover:bg-meal-warm/80">
              Clear selection
            </button>
            <label className="flex items-center gap-1.5 text-xs text-meal-muted ml-auto cursor-pointer">
              <input
                type="checkbox"
                checked={showUnchanged}
                onChange={(e) => setShowUnchanged(e.target.checked)}
                className="rounded border-meal-warm text-meal-sage"
              />
              Show unchanged ({rows.length - changedCount})
            </label>
          </div>

          <div className="bg-meal-card rounded-xl shadow-sm overflow-hidden">
            {visibleRows.map((r) => (
              <div key={r.id} className={`flex items-start gap-3 px-4 py-3 border-b border-meal-cream last:border-0 ${selected.has(r.id) ? "bg-meal-sage/5" : ""}`}>
                <input
                  type="checkbox"
                  checked={selected.has(r.id)}
                  onChange={() => toggleRow(r.id)}
                  disabled={!r.changed}
                  className="mt-2 rounded border-meal-warm text-meal-sage focus:ring-meal-sage disabled:opacity-30"
                />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-meal-muted/70 w-12">From</span>
                    <span className="text-sm text-meal-muted truncate">{r.current}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-meal-sage w-12">To</span>
                    <input
                      type="text"
                      value={r.suggested}
                      onChange={(e) => updateSuggested(r.id, e.target.value)}
                      className="flex-1 px-2 py-1 text-sm border border-meal-warm rounded bg-meal-cream/50 focus:outline-none focus:ring-1 focus:ring-meal-sage focus:bg-meal-card"
                    />
                  </div>
                </div>
              </div>
            ))}
            {visibleRows.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-meal-muted">
                {rows.length === 0 ? "No recipes found." : "Nothing to change. Tick \"Show unchanged\" to view all."}
              </div>
            )}
          </div>

          <div className="mt-6 flex gap-2">
            <button
              onClick={applySelected}
              disabled={applying || selected.size === 0}
              className="flex-1 py-3 rounded-xl bg-meal-sage text-white font-medium hover:bg-meal-sageHover disabled:opacity-50"
            >
              {applying ? "Applying..." : `Accept ${selected.size} selected`}
            </button>
            <Link
              href="/recipes"
              className="px-6 py-3 rounded-xl bg-meal-warm text-meal-charcoal text-sm font-medium hover:bg-meal-warm/80"
            >
              Skip
            </Link>
          </div>
        </>
      )}
    </div>
  )
}

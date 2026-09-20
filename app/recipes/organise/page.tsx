"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { CATEGORY_LABELS, CUISINES, toCategory, hasCuisine } from "@/types"
import type { Recipe, RecipeCategory } from "@/types"

/**
 * Re-file recipes in bulk.
 *
 * Built because switching to courses and cuisines meant every existing recipe
 * needed looking at, and doing that one recipe page at a time is the kind of
 * chore that never gets finished. Tick a few, hit a course or a cuisine, and
 * it applies to all of them.
 *
 * Nothing is written until Save. The pending count is always on screen so it
 * is obvious there is unsaved work.
 */

type Draft = { category: RecipeCategory; cuisines: string[] }

const COURSES = Object.entries(CATEGORY_LABELS) as [RecipeCategory, string][]

export default function OrganisePage() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [drafts, setDrafts] = useState<Record<number, Draft>>({})
  const [search, setSearch] = useState("")

  useEffect(() => {
    ;(async () => {
      const res = await fetch("/api/recipes")
      const data: Recipe[] = res.ok ? await res.json() : []
      setRecipes(data)
      setDrafts(Object.fromEntries(data.map((r) => [r.id, {
        category: toCategory(r.category),
        cuisines: CUISINES.filter((c) => hasCuisine(r.tags, c)) as string[],
      }])))
      setLoading(false)
    })()
  }, [])

  /** Everything the family typed themselves stays untouched — only the five
   *  cuisine tags are managed here. */
  const nonCuisineTags = (r: Recipe) =>
    (r.tags ?? []).filter((t) => !CUISINES.some((c) => c.toLowerCase() === t.toLowerCase()))

  const dirty = useMemo(() => recipes.filter((r) => {
    const d = drafts[r.id]
    if (!d) return false
    const wasCuisines = CUISINES.filter((c) => hasCuisine(r.tags, c)) as string[]
    return d.category !== toCategory(r.category)
      || d.cuisines.slice().sort().join("|") !== wasCuisines.slice().sort().join("|")
  }), [recipes, drafts])

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? recipes.filter((r) => r.title.toLowerCase().includes(q)) : recipes
  }, [recipes, search])

  const targets = () => (selected.size ? [...selected] : [])

  function setCourseOn(ids: number[], category: RecipeCategory) {
    setDrafts((prev) => {
      const next = { ...prev }
      for (const id of ids) if (next[id]) next[id] = { ...next[id], category }
      return next
    })
  }

  function toggleCuisineOn(ids: number[], cuisine: string, add: boolean) {
    setDrafts((prev) => {
      const next = { ...prev }
      for (const id of ids) {
        if (!next[id]) continue
        const has = next[id].cuisines.includes(cuisine)
        if (add && !has) next[id] = { ...next[id], cuisines: [...next[id].cuisines, cuisine] }
        if (!add && has) next[id] = { ...next[id], cuisines: next[id].cuisines.filter((c) => c !== cuisine) }
      }
      return next
    })
  }

  async function save() {
    if (!dirty.length) return
    setSaving(true)
    setNote(null)
    const res = await fetch("/api/recipes/bulk", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        updates: dirty.map((r) => ({
          id: r.id,
          category: drafts[r.id].category,
          tags: [...nonCuisineTags(r), ...drafts[r.id].cuisines],
        })),
      }),
    }).catch(() => null)

    if (res?.ok) {
      const { changed } = await res.json()
      // Re-read so "dirty" is measured against what is actually stored.
      const fresh = await fetch("/api/recipes")
      if (fresh.ok) setRecipes(await fresh.json())
      setSelected(new Set())
      setNote(`Saved ${changed} recipe${changed === 1 ? "" : "s"}.`)
    } else {
      setNote("Couldn't save those.")
    }
    setSaving(false)
  }

  if (loading) {
    return <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 text-meal-muted">Loading…</div>
  }

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 pb-40">
      <div className="flex items-center justify-between gap-4 mb-1">
        <h1 className="text-2xl font-semibold text-meal-charcoal">Organise</h1>
        <Link href="/recipes" className="text-sm text-meal-muted hover:text-meal-charcoal">Done</Link>
      </div>
      <p className="text-sm text-meal-muted mb-5">
        Set what each dish <em>is</em>, and which cuisine it belongs to. Tick several and apply to all of them at once.
      </p>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search recipes…"
        className="w-full mb-4 px-3 py-2 rounded-lg bg-meal-cream border border-meal-warm focus:outline-none focus:ring-2 focus:ring-meal-sage/30 text-sm"
      />

      {/* Bulk bar */}
      <div className="sticky top-0 z-10 bg-meal-card border border-meal-warm rounded-xl p-3 mb-4 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setSelected(new Set(shown.map((r) => r.id)))}
            className="text-xs font-medium text-meal-sage hover:underline"
          >
            Select all {shown.length !== recipes.length ? "shown" : ""}
          </button>
          <button onClick={() => setSelected(new Set())} className="text-xs font-medium text-meal-muted hover:underline">
            Clear
          </button>
          <span className="text-xs text-meal-muted ml-auto">
            {selected.size} selected{dirty.length ? ` · ${dirty.length} unsaved` : ""}
          </span>
        </div>

        <div className={selected.size ? "" : "opacity-40 pointer-events-none"}>
          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-meal-muted w-14">Course</span>
            {COURSES.map(([value, label]) => (
              <button key={value} onClick={() => setCourseOn(targets(), value)}
                className="px-2.5 py-1 rounded-full bg-meal-warm text-meal-charcoal text-xs font-medium hover:bg-meal-sage hover:text-white">
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider text-meal-muted w-14">Cuisine</span>
            {CUISINES.map((c) => (
              <span key={c} className="inline-flex rounded-full overflow-hidden border border-meal-warm">
                <button onClick={() => toggleCuisineOn(targets(), c, true)}
                  className="px-2.5 py-1 bg-meal-warm text-meal-charcoal text-xs font-medium hover:bg-meal-sage hover:text-white">
                  {c}
                </button>
                <button onClick={() => toggleCuisineOn(targets(), c, false)} title={`Remove ${c}`}
                  className="px-1.5 py-1 bg-meal-warm text-meal-muted text-xs hover:bg-meal-coral hover:text-white border-l border-meal-cream">
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Rows */}
      <div className="space-y-1.5">
        {shown.map((r) => {
          const d = drafts[r.id]
          if (!d) return null
          const isDirty = dirty.some((x) => x.id === r.id)
          return (
            <div key={r.id}
              className={`flex items-center gap-3 p-2.5 rounded-lg border ${
                isDirty ? "border-meal-sage bg-meal-sage/5" : "border-meal-warm bg-meal-card"
              }`}>
              <input
                type="checkbox"
                checked={selected.has(r.id)}
                onChange={(e) => setSelected((prev) => {
                  const next = new Set(prev)
                  if (e.target.checked) next.add(r.id); else next.delete(r.id)
                  return next
                })}
                className="w-4 h-4 shrink-0 accent-[#7f9c78]"
              />
              <span className="flex-1 min-w-0 truncate text-sm text-meal-charcoal">{r.title}</span>

              <div className="flex gap-1 shrink-0">
                {COURSES.map(([value, label]) => (
                  <button key={value} onClick={() => setCourseOn([r.id], value)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors ${
                      d.category === value ? "bg-meal-sage text-white" : "bg-meal-cream text-meal-muted hover:bg-meal-warm"
                    }`}>
                    {label}
                  </button>
                ))}
              </div>

              <div className="hidden sm:flex gap-1 shrink-0">
                {CUISINES.map((c) => (
                  <button key={c} onClick={() => toggleCuisineOn([r.id], c, !d.cuisines.includes(c))}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                      d.cuisines.includes(c) ? "bg-meal-coral text-white" : "bg-meal-cream text-meal-muted hover:bg-meal-warm"
                    }`}>
                    {c.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Save bar */}
      <div className="fixed bottom-16 md:bottom-4 left-0 right-0 px-4 md:px-6 z-20">
        <div className="max-w-5xl mx-auto flex items-center gap-3 bg-meal-card border border-meal-warm rounded-xl p-3 shadow-lg">
          <span className="text-sm text-meal-muted flex-1">
            {note ?? (dirty.length ? `${dirty.length} recipe${dirty.length === 1 ? "" : "s"} changed` : "No changes")}
          </span>
          <button
            onClick={save}
            disabled={!dirty.length || saving}
            className="px-4 py-2 rounded-lg bg-meal-sage text-white text-sm font-medium hover:bg-meal-sageHover disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  )
}

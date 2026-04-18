"use client"

import { useState, useEffect, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { AISLE_LABELS } from "@/types"
import type { ShoppingItem, AisleCategory, Staple } from "@/types"

function getMonday(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().split("T")[0]
}

export default function ShoppingPage() {
  const searchParams = useSearchParams()
  const week = searchParams.get("week") || getMonday(new Date())

  const [items, setItems] = useState<ShoppingItem[]>([])
  const [planId, setPlanId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [staples, setStaples] = useState<Staple[]>([])
  const [showStaples, setShowStaples] = useState(false)
  const [newItem, setNewItem] = useState("")

  // "Things we need" — persistent extras list (stored in localStorage)
  const [needItems, setNeedItems] = useState<string[]>([])
  const [newNeedItem, setNewNeedItem] = useState("")
  const [showNeeds, setShowNeeds] = useState(true)

  // Load needs from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("breslin-needs")
      if (stored) setNeedItems(JSON.parse(stored))
    } catch { /* ignore */ }
  }, [])

  function saveNeeds(updated: string[]) {
    setNeedItems(updated)
    localStorage.setItem("breslin-needs", JSON.stringify(updated))
  }

  function addNeedItem() {
    if (!newNeedItem.trim()) return
    const updated = [...needItems, newNeedItem.trim()]
    saveNeeds(updated)
    setNewNeedItem("")
  }

  function removeNeedItem(index: number) {
    saveNeeds(needItems.filter((_, i) => i !== index))
  }

  function addNeedToShoppingList(item: string, index: number) {
    if (!planId) return
    const shopItem: ShoppingItem = {
      name: item,
      quantity: "1",
      unit: "",
      aisle: "other",
      checked: false,
      from_recipe_ids: [],
      is_staple: false,
    }
    const updated = [...items, shopItem]
    setItems(updated)
    fetch("/api/shopping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan_id: planId, items: updated }),
    })
    // Remove from needs
    removeNeedItem(index)
  }

  function addAllNeedsToShoppingList() {
    if (!planId || needItems.length === 0) return
    const newShopItems: ShoppingItem[] = needItems.map((name) => ({
      name,
      quantity: "1",
      unit: "",
      aisle: "other",
      checked: false,
      from_recipe_ids: [],
      is_staple: false,
    }))
    const updated = [...items, ...newShopItems]
    setItems(updated)
    fetch("/api/shopping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan_id: planId, items: updated }),
    })
    saveNeeds([])
  }

  const fetchList = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/shopping?week=${week}`)
    const data = await res.json()
    setItems(data.items || [])
    setPlanId(data.plan_id || null)
    setLoading(false)
  }, [week])

  useEffect(() => { fetchList() }, [fetchList])

  async function toggleItem(index: number) {
    const updated = items.map((item, i) =>
      i === index ? { ...item, checked: !item.checked } : item
    )
    setItems(updated)
    if (planId) {
      await fetch("/api/shopping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: planId, items: updated }),
      })
    }
  }

  async function addCustomItem() {
    if (!newItem.trim() || !planId) return
    const item: ShoppingItem = {
      name: newItem.trim(),
      quantity: "1",
      unit: "",
      aisle: "other",
      checked: false,
      from_recipe_ids: [],
      is_staple: false,
    }
    const updated = [...items, item]
    setItems(updated)
    setNewItem("")
    await fetch("/api/shopping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan_id: planId, items: updated }),
    })
  }

  async function loadStaples() {
    setShowStaples(!showStaples)
    if (staples.length === 0) {
      const res = await fetch("/api/shopping/staples")
      if (res.ok) setStaples(await res.json())
    }
  }

  // Group by aisle
  const grouped = items.reduce<Record<string, (ShoppingItem & { _index: number })[]>>((acc, item, i) => {
    const aisle = item.aisle || "other"
    if (!acc[aisle]) acc[aisle] = []
    acc[aisle].push({ ...item, _index: i })
    return acc
  }, {})

  const uncheckedCount = items.filter((i) => !i.checked).length

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-6 py-6">
      {/* ── Things We Need ──────────────────────────────────────── */}
      <div className="mb-8">
        <button
          onClick={() => setShowNeeds(!showNeeds)}
          className="flex items-center justify-between w-full mb-3"
        >
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-meal-charcoal">Things We Need</h2>
            {needItems.length > 0 && (
              <span className="bg-meal-coral text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {needItems.length}
              </span>
            )}
          </div>
          <svg className={`w-5 h-5 text-meal-muted transition-transform ${showNeeds ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        {showNeeds && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs text-meal-muted mb-3">
              Ran out of something? Add it here anytime. Move items to your shopping list when you&apos;re ready.
            </p>

            {/* Add need item */}
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newNeedItem}
                onChange={(e) => setNewNeedItem(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addNeedItem()}
                placeholder="e.g. Olive oil, Paper towels, Dishwasher tablets..."
                className="flex-1 px-3 py-2 rounded-lg bg-meal-cream border border-meal-warm focus:outline-none focus:ring-2 focus:ring-meal-sage/30 text-sm"
              />
              <button onClick={addNeedItem} disabled={!newNeedItem.trim()}
                className="px-3 py-2 rounded-lg bg-meal-coral text-white text-sm font-medium disabled:opacity-50">
                Add
              </button>
            </div>

            {needItems.length === 0 ? (
              <p className="text-sm text-meal-muted text-center py-2">Nothing needed right now.</p>
            ) : (
              <>
                <div className="space-y-1 mb-3">
                  {needItems.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-meal-cream group">
                      <span className="flex-1 text-sm text-meal-charcoal">{item}</span>
                      {planId && (
                        <button
                          onClick={() => addNeedToShoppingList(item, i)}
                          className="text-[10px] font-medium text-meal-sage hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Add to shopping list"
                        >
                          + List
                        </button>
                      )}
                      <button
                        onClick={() => removeNeedItem(i)}
                        className="text-meal-muted hover:text-red-500 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
                {planId && (
                  <button
                    onClick={addAllNeedsToShoppingList}
                    className="w-full py-2 rounded-lg bg-meal-sage text-white text-sm font-medium hover:bg-meal-sageHover transition-colors"
                  >
                    Add All to Shopping List
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Shopping List ───────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-meal-charcoal">Shopping List</h1>
          <p className="text-sm text-meal-muted mt-0.5">
            {uncheckedCount} items remaining
          </p>
        </div>
        <button onClick={loadStaples}
          className="px-3 py-1.5 rounded-lg bg-meal-warm text-meal-charcoal text-sm font-medium hover:bg-meal-warm/80 transition-colors">
          Staples
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-meal-muted">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-meal-muted mb-2">No shopping list yet.</p>
          <p className="text-sm text-meal-muted">Plan some meals first, then come back here.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([aisle, aisleItems]) => (
            <div key={aisle}>
              <h2 className="text-xs font-semibold text-meal-muted uppercase tracking-wider mb-2">
                {AISLE_LABELS[aisle as AisleCategory] || aisle}
              </h2>
              <div className="bg-white rounded-xl overflow-hidden shadow-sm">
                {aisleItems.map((item) => (
                  <button
                    key={item._index}
                    onClick={() => toggleItem(item._index)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-meal-cream last:border-0 transition-colors hover:bg-meal-cream/50 ${
                      item.checked ? "opacity-50" : ""
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                      item.checked ? "bg-meal-sage border-meal-sage" : "border-meal-warm"
                    }`}>
                      {item.checked && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                    </div>
                    <span className={`flex-1 text-sm ${item.checked ? "line-through text-meal-muted" : "text-meal-charcoal"}`}>
                      {item.quantity && <span className="font-medium">{item.quantity}</span>}
                      {item.unit && <span className="font-medium"> {item.unit}</span>}
                      {" "}{item.name}
                    </span>
                    {item.is_staple && (
                      <span className="text-[10px] text-meal-muted font-medium">STAPLE</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add custom item */}
      {planId && (
        <div className="mt-6 flex gap-2">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCustomItem()}
            placeholder="Add item to list..."
            className="flex-1 px-4 py-2.5 rounded-lg bg-white border border-meal-warm focus:outline-none focus:ring-2 focus:ring-meal-sage/30 text-sm"
          />
          <button onClick={addCustomItem} disabled={!newItem.trim()}
            className="px-4 py-2.5 rounded-lg bg-meal-sage text-white text-sm font-medium disabled:opacity-50">
            Add
          </button>
        </div>
      )}

      {/* Staples panel */}
      {showStaples && (
        <div className="mt-6 bg-white rounded-xl p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-meal-charcoal mb-3">Your Staples</h2>
          <p className="text-sm text-meal-muted mb-4">Items you buy regularly. Active staples are auto-added to every shopping list.</p>
          {staples.length === 0 ? (
            <p className="text-sm text-meal-muted">No staples yet. They&apos;ll build up as you shop.</p>
          ) : (
            <div className="space-y-2">
              {staples.map((s) => (
                <div key={s.id} className="flex items-center gap-3 text-sm">
                  <span className={`w-2 h-2 rounded-full ${s.active ? "bg-meal-sage" : "bg-meal-warm"}`} />
                  <span className="flex-1 text-meal-charcoal">{s.name}</span>
                  <span className="text-meal-muted text-xs">{AISLE_LABELS[s.aisle as AisleCategory] || s.aisle}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

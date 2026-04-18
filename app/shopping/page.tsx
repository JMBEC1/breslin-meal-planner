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
  const grouped = items.reduce<Record<string, ShoppingItem[]>>((acc, item, i) => {
    const aisle = item.aisle || "other"
    if (!acc[aisle]) acc[aisle] = []
    acc[aisle].push({ ...item, _index: i } as ShoppingItem & { _index: number })
    return acc
  }, {})

  const uncheckedCount = items.filter((i) => !i.checked).length

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-6 py-6">
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
                {aisleItems.map((item) => {
                  const idx = (item as ShoppingItem & { _index: number })._index
                  return (
                    <button
                      key={idx}
                      onClick={() => toggleItem(idx)}
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
                  )
                })}
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
            placeholder="Add item..."
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

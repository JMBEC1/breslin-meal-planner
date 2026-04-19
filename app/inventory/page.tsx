"use client"

import { useState, useEffect, useCallback } from "react"
import { LOCATION_LABELS, AISLE_LABELS } from "@/types"
import type { InventoryItem, InventoryLocation, AisleCategory } from "@/types"

const ITEM_TYPE_LABELS: Record<string, string> = {
  batch_cook: "Batch Cooked",
  frozen_meal: "Frozen Meals",
  ready_meal: "Ready Meals",
  ingredient: "Ingredients",
}

export default function InventoryPage() {
  const [location, setLocation] = useState<InventoryLocation>("freezer")
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState("")
  const [newQty, setNewQty] = useState("")
  const [newUnit, setNewUnit] = useState("")
  const [newType, setNewType] = useState("ingredient")
  const [toast, setToast] = useState<{ item: InventoryItem; visible: boolean } | null>(null)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/inventory?location=${location}`)
    if (res.ok) setItems(await res.json())
    setLoading(false)
  }, [location])

  useEffect(() => { fetchItems() }, [fetchItems])

  async function addItem() {
    if (!newName.trim()) return
    await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName.trim(),
        location,
        item_type: newType,
        quantity: newQty || "1",
        unit: newUnit,
      }),
    })
    setNewName("")
    setNewQty("")
    setNewUnit("")
    fetchItems()
  }

  async function removeItem(item: InventoryItem) {
    await fetch(`/api/inventory/${item.id}`, { method: "DELETE" })
    setItems((prev) => prev.filter((i) => i.id !== item.id))
    setToast({ item, visible: true })
    setTimeout(() => setToast(null), 5000)
  }

  async function addToNeeds(name: string) {
    await fetch("/api/needs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
    setToast(null)
  }

  async function useFromFreezer(item: InventoryItem, day: string, mealType: string) {
    // Add to meal plan as custom text
    const weekStart = getMonday(new Date())
    const planRes = await fetch(`/api/plan?week=${weekStart}`)
    const plan = await planRes.json()
    const meals = plan?.meals || []
    const updated = meals.filter((m: { day: string; meal_type: string }) => !(m.day === day && m.meal_type === mealType))
    updated.push({ day, meal_type: mealType, recipe_id: null, custom_text: `Freezer: ${item.name}` })
    await fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ week_start: weekStart, meals: updated }),
    })

    // Decrement servings
    if (item.servings && item.servings > 1) {
      await fetch(`/api/inventory/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ servings: item.servings - 1 }),
      })
    } else {
      await fetch(`/api/inventory/${item.id}`, { method: "DELETE" })
    }
    fetchItems()
  }

  // Group items by type
  const grouped: Record<string, InventoryItem[]> = {}
  for (const item of items) {
    const key = item.item_type
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(item)
  }

  // Order: batch_cook, frozen_meal, ready_meal, ingredient
  const typeOrder = ["batch_cook", "frozen_meal", "ready_meal", "ingredient"]
  const sortedGroups = typeOrder.filter((t) => grouped[t]?.length).map((t) => ({ type: t, items: grouped[t] }))

  const [assignOpen, setAssignOpen] = useState<InventoryItem | null>(null)
  const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
  const DAY_LABELS: Record<string, string> = { monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu", friday: "Fri", saturday: "Sat", sunday: "Sun" }

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-6 py-6">
      <h1 className="text-2xl font-bold text-meal-charcoal mb-6">Pantry</h1>

      {/* Location tabs */}
      <div className="flex gap-1 bg-meal-warm rounded-lg p-1 mb-6">
        {(["freezer", "fridge", "pantry"] as InventoryLocation[]).map((loc) => (
          <button
            key={loc}
            onClick={() => setLocation(loc)}
            className={`flex-1 py-2.5 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
              location === loc ? "bg-white text-meal-charcoal shadow-sm" : "text-meal-muted"
            }`}
          >
            {loc === "freezer" && <span>❄️</span>}
            {loc === "fridge" && <span>🥬</span>}
            {loc === "pantry" && <span>🏠</span>}
            {LOCATION_LABELS[loc]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-meal-muted">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-meal-muted mb-2">Nothing in the {LOCATION_LABELS[location]} yet.</p>
          <p className="text-sm text-meal-muted">Add items below to track what you have.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedGroups.map(({ type, items: groupItems }) => (
            <div key={type}>
              <h2 className="text-xs font-semibold text-meal-muted uppercase tracking-wider mb-2">
                {ITEM_TYPE_LABELS[type] || type}
              </h2>
              <div className="bg-white rounded-xl overflow-hidden shadow-sm">
                {groupItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-3 border-b border-meal-cream last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-meal-charcoal">{item.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {item.quantity !== "1" || item.unit ? (
                          <span className="text-xs text-meal-muted">{item.quantity}{item.unit ? ` ${item.unit}` : ""}</span>
                        ) : null}
                        {item.servings && (
                          <span className="text-xs text-meal-plum font-medium">{item.servings} portion{item.servings > 1 ? "s" : ""}</span>
                        )}
                        <span className="text-xs text-meal-muted">{AISLE_LABELS[item.aisle as AisleCategory] || ""}</span>
                      </div>
                    </div>
                    {/* Assign to plan (for meals) */}
                    {(item.item_type === "batch_cook" || item.item_type === "frozen_meal" || item.item_type === "ready_meal") && (
                      <button
                        onClick={() => setAssignOpen(item)}
                        className="text-[10px] font-medium text-meal-sage hover:text-meal-sageHover px-2 py-1 rounded bg-meal-sage/10"
                      >
                        Plan
                      </button>
                    )}
                    {/* Remove */}
                    <button
                      onClick={() => removeItem(item)}
                      className="text-meal-muted hover:text-red-500 transition-colors p-1"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick add */}
      <div className="mt-6 bg-white rounded-xl p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-meal-charcoal mb-3">Add to {LOCATION_LABELS[location]}</h3>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addItem()}
            placeholder="Item name..."
            className="flex-1 px-3 py-2 rounded-lg bg-meal-cream border border-meal-warm focus:outline-none focus:ring-2 focus:ring-meal-sage/30 text-sm"
          />
          <input
            type="text"
            value={newQty}
            onChange={(e) => setNewQty(e.target.value)}
            placeholder="Qty"
            className="w-16 px-2 py-2 rounded-lg bg-meal-cream border border-meal-warm focus:outline-none focus:ring-2 focus:ring-meal-sage/30 text-sm"
          />
          <input
            type="text"
            value={newUnit}
            onChange={(e) => setNewUnit(e.target.value)}
            placeholder="Unit"
            className="w-16 px-2 py-2 rounded-lg bg-meal-cream border border-meal-warm focus:outline-none focus:ring-2 focus:ring-meal-sage/30 text-sm"
          />
        </div>
        {location === "freezer" && (
          <div className="flex gap-2 mb-2">
            {[
              { value: "ingredient", label: "Ingredient" },
              { value: "frozen_meal", label: "Frozen Meal" },
              { value: "ready_meal", label: "Ready Meal" },
            ].map((t) => (
              <button
                key={t.value}
                onClick={() => setNewType(t.value)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  newType === t.value ? "bg-meal-sage text-white" : "bg-meal-warm text-meal-charcoal"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={addItem}
          disabled={!newName.trim()}
          className="w-full py-2.5 rounded-lg bg-meal-sage text-white text-sm font-medium hover:bg-meal-sageHover transition-colors disabled:opacity-50"
        >
          Add to {LOCATION_LABELS[location]}
        </button>
      </div>

      {/* Toast: removed item */}
      {toast?.visible && (
        <div className="fixed bottom-24 md:bottom-8 left-4 right-4 md:left-auto md:right-8 md:w-80 bg-meal-charcoal text-white rounded-xl p-4 shadow-lg z-50 flex items-center gap-3">
          <p className="flex-1 text-sm">Removed <strong>{toast.item.name}</strong></p>
          <button
            onClick={() => addToNeeds(toast.item.name)}
            className="px-3 py-1 rounded-lg bg-meal-sage text-white text-xs font-medium shrink-0"
          >
            + Shopping List
          </button>
          <button onClick={() => setToast(null)} className="text-white/60 hover:text-white">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Assign to plan modal */}
      {assignOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center"
          onClick={() => setAssignOpen(null)}>
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-sm p-5"
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-meal-charcoal mb-2">Assign to Plan</h3>
            <p className="text-sm text-meal-muted mb-4">Pick a day for <strong>{assignOpen.name}</strong></p>
            <div className="grid grid-cols-2 gap-2">
              {DAYS.map((day) => (
                <button
                  key={day}
                  onClick={() => { useFromFreezer(assignOpen, day, "dinner"); setAssignOpen(null) }}
                  className="px-3 py-2.5 rounded-lg bg-meal-cream text-sm font-medium text-meal-charcoal hover:bg-meal-sage hover:text-white transition-colors"
                >
                  {DAY_LABELS[day]} Dinner
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function getMonday(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().split("T")[0]
}

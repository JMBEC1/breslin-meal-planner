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

  // Scan state
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState("")
  const [scannedItems, setScannedItems] = useState<{ name: string; quantity: string; unit: string; aisle: string; is_gluten_free: boolean; selected: boolean }[] | null>(null)
  const [savingScanned, setSavingScanned] = useState(false)

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

  function compressImage(file: File, maxWidth = 1600, quality = 0.7): Promise<Blob> {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement("canvas")
        let w = img.width
        let h = img.height
        if (w > maxWidth) { h = (h * maxWidth) / w; w = maxWidth }
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext("2d")!
        ctx.drawImage(img, 0, 0, w, h)
        canvas.toBlob((blob) => resolve(blob || file), "image/jpeg", quality)
      }
      img.src = URL.createObjectURL(file)
    })
  }

  async function handleScan(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return
    setScanning(true)
    setScannedItems(null)
    setScanError("")
    const formData = new FormData()
    for (let i = 0; i < files.length; i++) {
      const compressed = await compressImage(files[i])
      formData.append("images", compressed, `photo-${i}.jpg`)
    }
    formData.append("location", location)
    try {
      const res = await fetch("/api/inventory/scan", { method: "POST", body: formData })
      const data = await res.json()
      if (res.ok && data.items?.length > 0) {
        setScannedItems(data.items.map((item: { name: string; quantity: string; unit: string; aisle: string; is_gluten_free: boolean }) => ({ ...item, selected: true })))
      } else {
        setScanError(data.error || "No items found — try a clearer photo or closer up")
      }
    } catch {
      setScanError("Scan failed — check your connection and try again")
    }
    setScanning(false)
    e.target.value = ""
  }

  function toggleScannedItem(index: number) {
    setScannedItems((prev) => prev ? prev.map((item, i) => i === index ? { ...item, selected: !item.selected } : item) : prev)
  }

  async function saveScannedItems() {
    if (!scannedItems) return
    setSavingScanned(true)
    const selected = scannedItems.filter((item) => item.selected)
    for (const item of selected) {
      await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: item.name, location, item_type: "ingredient",
          quantity: item.quantity, unit: item.unit, aisle: item.aisle,
          is_gluten_free: item.is_gluten_free,
        }),
      })
    }
    setSavingScanned(false)
    setScannedItems(null)
    fetchItems()
  }

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

      {/* Scan to add */}
      <div className="mt-4 bg-white rounded-xl p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-meal-charcoal mb-2">Scan Items</h3>
        <p className="text-xs text-meal-muted mb-3">Snap photos of your shelves — AI reads the labels and adds everything. Multiple photos welcome!</p>
        <div className="flex gap-2">
          <label className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
            scanning ? "bg-meal-warm text-meal-muted" : "bg-meal-coral text-white hover:bg-meal-coral/80"
          }`}>
            {scanning ? (
              <>
                <div className="w-4 h-4 border-2 border-meal-coral border-t-transparent rounded-full animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                </svg>
                Take Photo
              </>
            )}
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleScan} disabled={scanning} />
          </label>
          <label className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
            scanning ? "bg-meal-warm text-meal-muted" : "bg-meal-warm text-meal-charcoal hover:bg-meal-warm/80"
          }`}>
            {scanning ? "..." : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                </svg>
                Upload Photos
              </>
            )}
            <input type="file" accept="image/*" multiple className="hidden" onChange={handleScan} disabled={scanning} />
          </label>
        </div>
        {scanError && (
          <div className="mt-2 p-3 bg-red-50 rounded-lg text-sm text-red-600">{scanError}</div>
        )}
      </div>

      {/* Scanned results */}
      {scannedItems && (
        <div className="mt-4 bg-white rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-meal-charcoal mb-1">Found {scannedItems.length} items</h3>
          <p className="text-xs text-meal-muted mb-3">Uncheck any you don&apos;t want to add.</p>
          <div className="space-y-1 mb-4">
            {scannedItems.map((item, i) => (
              <button
                key={i}
                onClick={() => toggleScannedItem(i)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  item.selected ? "bg-meal-cream" : "bg-meal-warm/30 opacity-50"
                }`}
              >
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                  item.selected ? "bg-meal-sage border-meal-sage" : "border-meal-warm"
                }`}>
                  {item.selected && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </div>
                <span className="flex-1 text-sm text-meal-charcoal">{item.name}</span>
                <span className="text-xs text-meal-muted">{item.quantity}{item.unit ? ` ${item.unit}` : ""}</span>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setScannedItems(null)}
              className="flex-1 py-2.5 rounded-lg bg-meal-warm text-meal-charcoal text-sm font-medium">
              Cancel
            </button>
            <button
              onClick={saveScannedItems}
              disabled={savingScanned || !scannedItems.some((i) => i.selected)}
              className="flex-1 py-2.5 rounded-lg bg-meal-sage text-white text-sm font-medium hover:bg-meal-sageHover transition-colors disabled:opacity-50"
            >
              {savingScanned ? "Adding..." : `Add ${scannedItems.filter((i) => i.selected).length} Items`}
            </button>
          </div>
        </div>
      )}

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

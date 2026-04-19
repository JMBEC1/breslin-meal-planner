"use client"

import { useState, useEffect, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { AISLE_LABELS, LOCATION_LABELS } from "@/types"
import type { ShoppingItem, AisleCategory, Staple, NeedItem, InventoryLocation } from "@/types"

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
  const [newItemQty, setNewItemQty] = useState("")
  const [newItemUnit, setNewItemUnit] = useState("")
  const [copied, setCopied] = useState(false)

  // Things We Need — now database-backed
  const [needItems, setNeedItems] = useState<NeedItem[]>([])
  const [newNeedItem, setNewNeedItem] = useState("")
  const [showNeeds, setShowNeeds] = useState(true)

  // Add to inventory state
  const [showStockUp, setShowStockUp] = useState(false)
  const [stockUpItems, setStockUpItems] = useState<{ name: string; quantity: string; unit: string; aisle: string; location: InventoryLocation; selected: boolean }[]>([])
  const [savingStock, setSavingStock] = useState(false)

  // Load needs from database
  useEffect(() => {
    fetch("/api/needs").then((r) => r.ok ? r.json() : []).then(setNeedItems)
  }, [])

  async function addNeedItem() {
    if (!newNeedItem.trim()) return
    const res = await fetch("/api/needs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newNeedItem.trim() }),
    })
    if (res.ok) {
      const need = await res.json()
      setNeedItems((prev) => [need, ...prev])
    }
    setNewNeedItem("")
  }

  async function removeNeedItem(id: number) {
    await fetch(`/api/needs/${id}`, { method: "DELETE" })
    setNeedItems((prev) => prev.filter((n) => n.id !== id))
  }

  function addNeedToShoppingList(need: NeedItem) {
    if (!planId) return
    const shopItem: ShoppingItem = {
      name: need.name, quantity: "1", unit: "", aisle: "other",
      checked: false, from_recipe_ids: [], is_staple: false,
    }
    const updated = [...items, shopItem]
    setItems(updated)
    fetch("/api/shopping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan_id: planId, items: updated }),
    })
    removeNeedItem(need.id)
  }

  async function addAllNeedsToShoppingList() {
    if (!planId || needItems.length === 0) return
    const newShopItems: ShoppingItem[] = needItems.map((n) => ({
      name: n.name, quantity: "1", unit: "", aisle: "other",
      checked: false, from_recipe_ids: [], is_staple: false,
    }))
    const updated = [...items, ...newShopItems]
    setItems(updated)
    await fetch("/api/shopping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan_id: planId, items: updated }),
    })
    await fetch("/api/needs", { method: "DELETE" })
    setNeedItems([])
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
      name: newItem.trim(), quantity: newItemQty || "1", unit: newItemUnit, aisle: "other",
      checked: false, from_recipe_ids: [], is_staple: false,
    }
    const updated = [...items, item]
    setItems(updated)
    setNewItem("")
    setNewItemQty("")
    setNewItemUnit("")
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

  // Group by aisle — separate inventory items
  const regularItems: (ShoppingItem & { _index: number })[] = []
  const inventoryItems: (ShoppingItem & { _index: number })[] = []
  items.forEach((item, i) => {
    const entry = { ...item, _index: i }
    if (item.in_inventory) inventoryItems.push(entry)
    else regularItems.push(entry)
  })

  const grouped = regularItems.reduce<Record<string, (ShoppingItem & { _index: number })[]>>((acc, item) => {
    const aisle = item.aisle || "other"
    if (!acc[aisle]) acc[aisle] = []
    acc[aisle].push(item)
    return acc
  }, {})

  const checkedItems = regularItems.filter((i) => i.checked)
  const uncheckedCount = regularItems.filter((i) => !i.checked).length

  function guessLocation(aisle: string): InventoryLocation {
    if (aisle === "frozen") return "freezer"
    if (["meat-seafood", "dairy-eggs", "fruit-veg"].includes(aisle)) return "fridge"
    return "pantry"
  }

  function openStockUp() {
    setStockUpItems(checkedItems.map((item) => ({
      name: item.name,
      quantity: item.quantity || "1",
      unit: item.unit || "",
      aisle: item.aisle || "other",
      location: guessLocation(item.aisle || "other"),
      selected: true,
    })))
    setShowStockUp(true)
  }

  async function saveStockUp() {
    setSavingStock(true)
    const selected = stockUpItems.filter((i) => i.selected)
    for (const item of selected) {
      await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: item.name,
          location: item.location,
          item_type: "ingredient",
          quantity: item.quantity,
          unit: item.unit,
        }),
      })
    }
    setSavingStock(false)
    setShowStockUp(false)
  }

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
              Ran out of something? Add it here — syncs across all devices.
            </p>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newNeedItem}
                onChange={(e) => setNewNeedItem(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addNeedItem()}
                placeholder="e.g. Olive oil, Paper towels..."
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
                  {needItems.map((need) => (
                    <div key={need.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-meal-cream group">
                      <span className="flex-1 text-sm text-meal-charcoal">{need.name}</span>
                      {planId && (
                        <button
                          onClick={() => addNeedToShoppingList(need)}
                          className="text-[10px] font-medium text-meal-sage hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          + List
                        </button>
                      )}
                      <button onClick={() => removeNeedItem(need.id)}
                        className="text-meal-muted hover:text-red-500 transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
                {planId && (
                  <button onClick={addAllNeedsToShoppingList}
                    className="w-full py-2 rounded-lg bg-meal-sage text-white text-sm font-medium hover:bg-meal-sageHover transition-colors">
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
          <p className="text-sm text-meal-muted mt-0.5">{uncheckedCount} items remaining</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              setLoading(true)
              const res = await fetch(`/api/shopping?week=${week}&refresh=true`)
              const data = await res.json()
              setItems(data.items || [])
              setPlanId(data.plan_id || null)
              setLoading(false)
            }}
            className="px-3 py-1.5 rounded-lg bg-meal-sage text-white text-sm font-medium hover:bg-meal-sageHover transition-colors"
          >
            Regenerate
          </button>
          <button onClick={loadStaples}
            className="px-3 py-1.5 rounded-lg bg-meal-warm text-meal-charcoal text-sm font-medium hover:bg-meal-warm/80 transition-colors">
            Staples
          </button>
        </div>
      </div>

      {/* Quick add — always visible */}
      {planId && !loading && (
        <div className="mb-4 flex gap-2">
          <input type="text" value={newItem} onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCustomItem()}
            placeholder="Add item..."
            className="flex-1 px-4 py-2.5 rounded-lg bg-white border border-meal-warm focus:outline-none focus:ring-2 focus:ring-meal-sage/30 text-sm" />
          <input type="text" value={newItemQty} onChange={(e) => setNewItemQty(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCustomItem()}
            placeholder="Qty"
            className="w-14 px-2 py-2.5 rounded-lg bg-white border border-meal-warm focus:outline-none focus:ring-2 focus:ring-meal-sage/30 text-sm text-center" />
          <input type="text" value={newItemUnit} onChange={(e) => setNewItemUnit(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCustomItem()}
            placeholder="Unit"
            className="w-14 px-2 py-2.5 rounded-lg bg-white border border-meal-warm focus:outline-none focus:ring-2 focus:ring-meal-sage/30 text-sm text-center" />
          <button onClick={addCustomItem} disabled={!newItem.trim()}
            className="px-4 py-2.5 rounded-lg bg-meal-sage text-white text-sm font-medium disabled:opacity-50">Add</button>
        </div>
      )}

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
                  <div key={item._index} className="border-b border-meal-cream last:border-0">
                    <button
                      onClick={() => toggleItem(item._index)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-meal-cream/50 ${
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
                      {item.is_staple && <span className="text-[10px] text-meal-muted font-medium">STAPLE</span>}
                    </button>
                    {item.alternative_note && !item.checked && (
                      <div className="px-4 pb-2 -mt-1 ml-8">
                        <p className="text-xs text-meal-coral font-medium">💡 {item.alternative_note}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Already Have section */}
          {inventoryItems.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-meal-sage uppercase tracking-wider mb-2">
                Already Have
              </h2>
              <div className="bg-meal-sage/5 rounded-xl overflow-hidden border border-meal-sage/20">
                {inventoryItems.map((item) => (
                  <div
                    key={item._index}
                    className="flex items-center gap-3 px-4 py-3 border-b border-meal-sage/10 last:border-0 opacity-60"
                  >
                    <svg className="w-4 h-4 text-meal-sage shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    <span className="flex-1 text-sm text-meal-charcoal">
                      {item.quantity && <span className="font-medium">{item.quantity}</span>}
                      {item.unit && <span className="font-medium"> {item.unit}</span>}
                      {" "}{item.name}
                    </span>
                    <span className="text-[10px] text-meal-sage font-medium">
                      {item.inventory_note || "In stock"}
                    </span>
                    <button
                      onClick={() => toggleItem(item._index)}
                      className="text-[10px] text-meal-muted hover:text-meal-charcoal"
                    >
                      + need more
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Done shopping — add to inventory */}
      {checkedItems.length > 0 && !loading && (
        <div className="mt-6">
          <button
            onClick={openStockUp}
            className="w-full py-3 rounded-xl bg-meal-coral text-white text-sm font-medium hover:bg-meal-coral/90 transition-colors shadow-sm flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
            Done Shopping? Stock Up Pantry ({checkedItems.length} items)
          </button>
        </div>
      )}

      {/* Stock up modal */}
      {showStockUp && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center" onClick={() => setShowStockUp(false)}>
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 pb-3">
              <h3 className="text-lg font-semibold text-meal-charcoal">Stock Up Pantry</h3>
              <p className="text-sm text-meal-muted mt-1">Choose where each item goes. Uncheck any you don&apos;t want to track.</p>
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-3">
              <div className="space-y-2">
                {stockUpItems.map((item, i) => (
                  <div key={i} className={`flex items-center gap-2 px-3 py-2.5 rounded-lg transition-colors ${item.selected ? "bg-meal-cream" : "bg-meal-warm/30 opacity-50"}`}>
                    <button
                      onClick={() => setStockUpItems((prev) => prev.map((p, j) => j === i ? { ...p, selected: !p.selected } : p))}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${item.selected ? "bg-meal-sage border-meal-sage" : "border-meal-warm"}`}
                    >
                      {item.selected && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                    </button>
                    <span className="flex-1 text-sm text-meal-charcoal min-w-0 truncate">{item.quantity !== "1" || item.unit ? `${item.quantity}${item.unit ? " " + item.unit : ""} ` : ""}{item.name}</span>
                    <select
                      value={item.location}
                      onChange={(e) => setStockUpItems((prev) => prev.map((p, j) => j === i ? { ...p, location: e.target.value as InventoryLocation } : p))}
                      className="text-xs px-2 py-1 rounded-lg bg-white border border-meal-warm text-meal-charcoal focus:outline-none focus:ring-1 focus:ring-meal-sage"
                    >
                      <option value="fridge">🥬 Fridge</option>
                      <option value="freezer">❄️ Freezer</option>
                      <option value="pantry">🏠 Pantry</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-5 pt-3 flex gap-2 border-t border-meal-cream">
              <button onClick={() => setShowStockUp(false)}
                className="flex-1 py-2.5 rounded-lg bg-meal-warm text-meal-charcoal text-sm font-medium">
                Cancel
              </button>
              <button
                onClick={saveStockUp}
                disabled={savingStock || !stockUpItems.some((i) => i.selected)}
                className="flex-1 py-2.5 rounded-lg bg-meal-sage text-white text-sm font-medium hover:bg-meal-sageHover transition-colors disabled:opacity-50"
              >
                {savingStock ? "Adding..." : `Add ${stockUpItems.filter((i) => i.selected).length} to Inventory`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Copy list + store links */}
      {items.length > 0 && (
        <div className="mt-6 space-y-3">
          <button
            onClick={() => {
              const unchecked = regularItems.filter((i) => !i.checked)
              const text = unchecked.map((i) => {
                const qty = i.quantity ? `${i.quantity}${i.unit ? " " + i.unit : ""} ` : ""
                return `${qty}${i.name}`
              }).join("\n")
              navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
            }}
            className="w-full py-3 rounded-xl bg-white shadow-sm text-sm font-medium text-meal-charcoal hover:shadow-md transition-shadow flex items-center justify-center gap-2"
          >
            {copied ? (
              <><svg className="w-5 h-5 text-meal-sage" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>Copied!</>
            ) : (
              <><svg className="w-5 h-5 text-meal-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" /></svg>Copy Shopping List</>
            )}
          </button>
          <div className="grid grid-cols-2 gap-3">
            <a href="https://www.woolworths.com.au/shop/lists" target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-[#125B33] text-white text-sm font-medium hover:bg-[#0e4a29] transition-colors shadow-sm">
              Woolworths
            </a>
            <a href="https://www.coles.com.au/find-and-add" target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-[#E01A22] text-white text-sm font-medium hover:bg-[#c4171e] transition-colors shadow-sm">
              Coles
            </a>
          </div>
          <p className="text-xs text-meal-muted text-center">Copy list above, then paste into your Woolworths or Coles shopping list</p>
        </div>
      )}

      {/* Staples panel */}
      {showStaples && (
        <div className="mt-6 bg-white rounded-xl p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-meal-charcoal mb-3">Your Staples</h2>
          <p className="text-sm text-meal-muted mb-4">Active staples are auto-added to every shopping list.</p>
          {staples.length === 0 ? (
            <p className="text-sm text-meal-muted">No staples yet.</p>
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

"use client"

import { useState, useEffect } from "react"
import { StarRating } from "./StarRating"
import { FAMILY_MEMBERS } from "@/types"
import type { FamilyMember, Rating } from "@/types"

interface RecipeRatingProps {
  recipeId: number
}

export function RecipeRating({ recipeId }: RecipeRatingProps) {
  const [ratings, setRatings] = useState<Rating[]>([])
  const [easeOfCooking, setEaseOfCooking] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/ratings?recipe_id=${recipeId}`)
      .then((r) => r.json())
      .then((data) => {
        setRatings(data)
        // Use the first rating's ease value as default (it's shared)
        if (data.length > 0) setEaseOfCooking(data[0].ease_of_cooking)
        setLoading(false)
      })
  }, [recipeId])

  function getRating(person: FamilyMember): number {
    return ratings.find((r) => r.person === person)?.enjoyment || 0
  }

  async function handleRate(person: FamilyMember, enjoyment: number) {
    // Optimistic update
    setRatings((prev) => {
      const existing = prev.find((r) => r.person === person)
      if (existing) {
        return prev.map((r) => r.person === person ? { ...r, enjoyment } : r)
      }
      return [...prev, { id: 0, recipe_id: recipeId, person, enjoyment, ease_of_cooking: easeOfCooking, created_at: "" }]
    })

    const res = await fetch("/api/ratings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipe_id: recipeId, person, enjoyment, ease_of_cooking: easeOfCooking }),
    })
    if (res.ok) setRatings(await res.json())
  }

  async function handleEaseChange(value: number) {
    setEaseOfCooking(value)
    // Update ease for all existing ratings
    for (const r of ratings) {
      await fetch("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipe_id: recipeId, person: r.person, enjoyment: r.enjoyment, ease_of_cooking: value }),
      })
    }
    // If no ratings exist yet, save for James as a starting point
    if (ratings.length === 0) {
      const res = await fetch("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipe_id: recipeId, person: "James", enjoyment: 0, ease_of_cooking: value }),
      })
      if (res.ok) setRatings(await res.json())
    }
  }

  if (loading) return null

  return (
    <div className="bg-white rounded-xl p-5 mb-6 shadow-sm">
      <h2 className="text-lg font-semibold text-meal-charcoal mb-4">Ratings</h2>

      {/* Ease of cooking */}
      <div className="mb-4 pb-4 border-b border-meal-cream">
        <div className="flex items-center justify-between">
          <span className="text-sm text-meal-muted">Ease of cooking</span>
          <StarRating value={easeOfCooking} onChange={handleEaseChange} />
        </div>
      </div>

      {/* Per-person enjoyment */}
      <div className="space-y-3">
        <span className="text-sm text-meal-muted">How much did you enjoy it?</span>
        {FAMILY_MEMBERS.map((person) => (
          <div key={person} className="flex items-center justify-between">
            <span className="text-sm font-medium text-meal-charcoal w-16">{person}</span>
            <StarRating value={getRating(person)} onChange={(v) => handleRate(person, v)} />
          </div>
        ))}
      </div>
    </div>
  )
}

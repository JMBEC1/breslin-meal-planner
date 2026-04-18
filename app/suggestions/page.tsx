"use client"

import { useState } from "react"

const QUICK_PROMPTS = [
  "Suggest 5 quick GF dinners for this week",
  "What are some healthy GF school lunch ideas?",
  "Suggest a fancy dinner for a special occasion",
  "What fresh produce is in season in Australia right now?",
  "Quick 15-minute weeknight meal ideas (GF)",
  "Kid-friendly GF packed lunch ideas that aren't boring",
]

export default function SuggestionsPage() {
  const [message, setMessage] = useState("")
  const [response, setResponse] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(text: string) {
    if (!text.trim()) return
    setLoading(true)
    setResponse("")
    setMessage("")

    const res = await fetch("/api/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text.trim() }),
    })

    if (res.ok) {
      const data = await res.json()
      setResponse(data.response)
    } else {
      const err = await res.json()
      setResponse(`Error: ${err.error || "Something went wrong"}`)
    }
    setLoading(false)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-6 py-6">
      <h1 className="text-2xl font-bold text-meal-charcoal mb-2">Meal Suggestions</h1>
      <p className="text-sm text-meal-muted mb-6">
        Ask for meal ideas, recipes, or cooking tips. Our AI knows your family&apos;s GF needs.
      </p>

      {/* Quick prompts */}
      <div className="mb-6">
        <h2 className="text-xs font-semibold text-meal-muted uppercase tracking-wider mb-3">Quick ideas</h2>
        <div className="flex flex-wrap gap-2">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => handleSubmit(prompt)}
              disabled={loading}
              className="px-3 py-2 rounded-lg bg-meal-warm text-meal-charcoal text-sm hover:bg-meal-sage hover:text-white transition-colors disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Custom input */}
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit(message)}
          placeholder="Ask me anything about meals..."
          className="flex-1 px-4 py-2.5 rounded-lg bg-white border border-meal-warm focus:outline-none focus:ring-2 focus:ring-meal-sage/30 text-sm"
          disabled={loading}
        />
        <button
          onClick={() => handleSubmit(message)}
          disabled={loading || !message.trim()}
          className="px-4 py-2.5 rounded-lg bg-meal-sage text-white text-sm font-medium hover:bg-meal-sageHover transition-colors disabled:opacity-50"
        >
          {loading ? "Thinking..." : "Ask"}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="bg-white rounded-xl p-6 shadow-sm text-center">
          <div className="inline-block w-6 h-6 border-2 border-meal-sage border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-meal-muted mt-3">Cooking up some ideas...</p>
        </div>
      )}

      {/* Response */}
      {response && !loading && (
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="prose prose-sm max-w-none text-meal-charcoal whitespace-pre-line">
            {response.split("\n").map((line, i) => {
              if (line.startsWith("**") && line.includes("**")) {
                const parts = line.split("**")
                return (
                  <p key={i} className="font-semibold text-meal-charcoal mt-4 first:mt-0">
                    {parts.map((part, j) =>
                      j % 2 === 1 ? <strong key={j}>{part}</strong> : <span key={j}>{part}</span>
                    )}
                  </p>
                )
              }
              if (line.startsWith("Prep:") || line.startsWith("- ")) {
                return <p key={i} className="text-meal-muted text-xs">{line}</p>
              }
              return line.trim() ? <p key={i}>{line}</p> : <br key={i} />
            })}
          </div>
        </div>
      )}
    </div>
  )
}

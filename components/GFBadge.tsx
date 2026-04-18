export function GFBadge({ isGlutenFree, size = "sm" }: { isGlutenFree: boolean; size?: "sm" | "md" }) {
  const sizeClasses = size === "md" ? "px-3 py-1 text-xs" : "px-2 py-0.5 text-[10px]"

  if (isGlutenFree) {
    return (
      <span className={`inline-flex items-center gap-1 ${sizeClasses} font-semibold rounded-full bg-meal-sage text-white`}>
        <svg className={size === "md" ? "w-3.5 h-3.5" : "w-3 h-3"} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
        GF
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center gap-1 ${sizeClasses} font-semibold rounded-full bg-meal-amber/90 text-white`}>
      Contains Gluten
    </span>
  )
}

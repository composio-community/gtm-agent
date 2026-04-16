export type Recurrence = "daily" | "weekly" | "hourly"

export function isRecurrence(v: unknown): v is Recurrence {
  return v === "daily" || v === "weekly" || v === "hourly"
}

export function nextRunTime(current: Date, recurrence: Recurrence): Date {
  const next = new Date(current)
  switch (recurrence) {
    case "hourly":
      next.setHours(next.getHours() + 1)
      return next
    case "daily":
      next.setDate(next.getDate() + 1)
      return next
    case "weekly":
      next.setDate(next.getDate() + 7)
      return next
  }
}

export function humanize(iso: string, recurrence: Recurrence | null | undefined): string {
  const d = new Date(iso)
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  if (!recurrence) {
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }
  if (recurrence === "daily") return `every day at ${time}`
  if (recurrence === "hourly") {
    return `every hour at :${d.getMinutes().toString().padStart(2, "0")}`
  }
  if (recurrence === "weekly") {
    const dow = d.toLocaleDateString(undefined, { weekday: "long" })
    return `every ${dow} at ${time}`
  }
  return iso
}

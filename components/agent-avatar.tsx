import { avatarSrc } from "@/lib/avatar-set"

const PALETTE = [
  { bg: "#1e293b", fg: "#ffffff" }, // slate
  { bg: "#4338ca", fg: "#ffffff" }, // indigo
  { bg: "#0f766e", fg: "#ffffff" }, // teal
  { bg: "#9a3412", fg: "#ffffff" }, // rust
  { bg: "#9f1239", fg: "#ffffff" }, // rose
  { bg: "#6d28d9", fg: "#ffffff" }, // violet
  { bg: "#065f46", fg: "#ffffff" }, // emerald
  { bg: "#0369a1", fg: "#ffffff" }, // sky
  { bg: "#713f12", fg: "#ffffff" }, // amber
  { bg: "#831843", fg: "#ffffff" }, // magenta
]

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0][0]!.toUpperCase()
  return (parts[0][0]! + parts[parts.length - 1][0]!).toUpperCase()
}

type Props = {
  id: string
  name: string
  avatar?: string | null
  size?: number
  className?: string
}

export function AgentAvatar({ id, name, avatar, size = 28, className }: Props) {
  const src = avatarSrc(avatar)
  const { bg, fg } = PALETTE[hash(id) % PALETTE.length]
  const label = initials(name)
  const fontSize = Math.round(size * (label.length > 1 ? 0.38 : 0.46))

  const base = {
    display: "inline-flex" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    width: size,
    height: size,
    borderRadius: "50%",
    flexShrink: 0,
    userSelect: "none" as const,
    overflow: "hidden" as const,
  }

  if (src) {
    return (
      <span
        className={className}
        aria-label={name}
        style={{
          ...base,
          background: "#f5f5f5",
          boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.06)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={name}
          width={size}
          height={size}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            imageRendering: "pixelated",
          }}
        />
      </span>
    )
  }

  return (
    <span
      className={className}
      aria-label={name}
      style={{
        ...base,
        background: bg,
        color: fg,
        fontSize,
        fontWeight: 500,
        letterSpacing: 0.2,
        lineHeight: 1,
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)",
      }}
    >
      {label}
    </span>
  )
}

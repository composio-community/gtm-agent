// Static pop-culture-archetype avatars. Drop the PNGs into public/avatars/
// using the `file` name below. Keys are what we store in agents.avatar.

export type AvatarOption = {
  key: string
  label: string
  file: string // served from /avatars/{file}
}

export const AVATAR_SET: AvatarOption[] = [
  { key: "detective", label: "Detective", file: "detective.png" },
  { key: "wizard",    label: "Wizard",    file: "wizard.png" },
  { key: "astronaut", label: "Astronaut", file: "astronaut.png" },
  { key: "samurai",   label: "Samurai",   file: "samurai.png" },
  { key: "hacker",    label: "Hacker",    file: "hacker.png" },
  { key: "pirate",    label: "Pirate",    file: "pirate.png" },
  { key: "scientist", label: "Scientist", file: "scientist.png" },
  { key: "cowboy",    label: "Cowboy",    file: "cowboy.png" },
  { key: "ninja",     label: "Ninja",     file: "ninja.png" },
  { key: "chef",      label: "Chef",      file: "chef.png" },
  { key: "monk",      label: "Monk",      file: "monk.png" },
  { key: "racer",     label: "Racer",     file: "racer.png" },
]

const BY_KEY = new Map(AVATAR_SET.map((a) => [a.key, a]))

export function getAvatarOption(key: string | null | undefined): AvatarOption | null {
  if (!key) return null
  return BY_KEY.get(key) ?? null
}

export function avatarSrc(key: string | null | undefined): string | null {
  const opt = getAvatarOption(key)
  return opt ? `/avatars/${opt.file}` : null
}

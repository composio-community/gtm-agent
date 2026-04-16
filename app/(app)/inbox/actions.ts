"use server"

import { revalidatePath } from "next/cache"
import { markAllRead, markRead } from "@/lib/notifications"

export async function markReadAction(formData: FormData) {
  const id = String(formData.get("id") ?? "")
  if (id) await markRead(id)
  revalidatePath("/inbox")
}

export async function markAllReadAction() {
  await markAllRead()
  revalidatePath("/inbox")
}

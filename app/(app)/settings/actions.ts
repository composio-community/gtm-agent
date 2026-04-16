"use server"

import { revalidatePath } from "next/cache"
import { getServerSupabase } from "@/lib/supabase/server"

export async function disconnectAction(formData: FormData) {
  const provider = String(formData.get("provider") ?? "")
  if (!provider) return
  const supabase = await getServerSupabase()
  await supabase.from("integrations").delete().eq("provider", provider)
  revalidatePath("/settings")
}

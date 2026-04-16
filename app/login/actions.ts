"use server"

import { redirect } from "next/navigation"
import { getServerSupabase } from "@/lib/supabase/server"

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "")
  const password = String(formData.get("password") ?? "")
  const next = String(formData.get("next") ?? "/kanban")

  const supabase = await getServerSupabase()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`)
  }
  redirect(next || "/kanban")
}

export async function signUpAction(formData: FormData) {
  const email = String(formData.get("email") ?? "")
  const password = String(formData.get("password") ?? "")
  const next = String(formData.get("next") ?? "/kanban")

  const supabase = await getServerSupabase()
  const { error, data } = await supabase.auth.signUp({ email, password })
  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`)
  }
  if (!data.session) {
    redirect(`/login?info=${encodeURIComponent("Check your email to confirm your account.")}`)
  }
  redirect(next || "/kanban")
}

export async function signOutAction() {
  const supabase = await getServerSupabase()
  await supabase.auth.signOut()
  redirect("/login")
}

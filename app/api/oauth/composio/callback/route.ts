import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getSessionUser } from "@/lib/supabase/server"
import { getServerSupabase } from "@/lib/supabase/server"
import { exchangeCode } from "@/lib/oauth"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.redirect(new URL("/login", req.url))

  const { searchParams } = new URL(req.url)
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")

  if (error) {
    return NextResponse.redirect(new URL(`/settings?error=${encodeURIComponent(error)}`, req.url))
  }
  if (!code || !state) {
    return NextResponse.redirect(new URL("/settings?error=missing+code+or+state", req.url))
  }

  const cookieStore = await cookies()
  const raw = cookieStore.get("composio_oauth")?.value
  cookieStore.delete("composio_oauth")

  if (!raw) {
    return NextResponse.redirect(new URL("/settings?error=missing+oauth+cookie", req.url))
  }

  const saved = JSON.parse(raw) as {
    state: string
    verifier: string
    clientId: string
    redirectUri: string
  }

  if (state !== saved.state) {
    return NextResponse.redirect(new URL("/settings?error=invalid+state", req.url))
  }

  let token: { access_token: string; refresh_token?: string; expires_in?: number }
  try {
    token = await exchangeCode({
      code,
      clientId: saved.clientId,
      codeVerifier: saved.verifier,
      redirectUri: saved.redirectUri,
    })
  } catch (e: any) {
    return NextResponse.redirect(
      new URL(`/settings?error=${encodeURIComponent(e?.message ?? "token exchange failed")}`, req.url),
    )
  }

  const expiresAt = token.expires_in
    ? new Date(Date.now() + token.expires_in * 1000).toISOString()
    : null

  const supabase = await getServerSupabase()
  const { error: dbErr } = await supabase.from("integrations").upsert(
    {
      user_id: user.id,
      provider: "composio_mcp",
      access_token: token.access_token,
      refresh_token: token.refresh_token ?? null,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" },
  )

  if (dbErr) {
    return NextResponse.redirect(
      new URL(`/settings?error=${encodeURIComponent(dbErr.message)}`, req.url),
    )
  }

  return NextResponse.redirect(new URL("/settings?connected=composio", req.url))
}

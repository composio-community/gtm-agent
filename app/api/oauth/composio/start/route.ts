import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getSessionUser } from "@/lib/supabase/server"
import { discoverOAuth, registerClient, generatePKCE } from "@/lib/oauth"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const origin = new URL(req.url).origin
  const redirectUri = `${origin}/api/oauth/composio/callback`

  const [meta, clientId, pkce] = await Promise.all([
    discoverOAuth(),
    registerClient(redirectUri),
    generatePKCE(),
  ])

  const state = crypto.randomUUID()

  const cookieStore = await cookies()
  cookieStore.set("composio_oauth", JSON.stringify({
    state,
    verifier: pkce.verifier,
    clientId,
    redirectUri,
  }), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  })

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: pkce.challenge,
    code_challenge_method: "S256",
    state,
    scope: "openid profile email offline_access",
  })

  return NextResponse.redirect(`${meta.authorization_endpoint}?${params}`)
}

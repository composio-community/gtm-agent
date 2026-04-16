import "server-only"

const WELL_KNOWN = "https://connect.composio.dev/.well-known/oauth-authorization-server"

type OAuthMeta = {
  authorization_endpoint: string
  token_endpoint: string
  registration_endpoint: string
}

let cachedMeta: OAuthMeta | null = null

export async function discoverOAuth(): Promise<OAuthMeta> {
  if (cachedMeta) return cachedMeta
  const res = await fetch(WELL_KNOWN)
  if (!res.ok) throw new Error(`OAuth discovery failed: ${res.status}`)
  cachedMeta = await res.json()
  return cachedMeta!
}

export async function registerClient(redirectUri: string): Promise<string> {
  const meta = await discoverOAuth()
  const res = await fetch(meta.registration_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "GTM Agent",
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Client registration failed (${res.status}): ${text}`)
  }
  const data = await res.json()
  return data.client_id
}

export async function generatePKCE(): Promise<{ verifier: string; challenge: string }> {
  const buf = new Uint8Array(32)
  crypto.getRandomValues(buf)
  const verifier = base64url(buf)
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))
  const challenge = base64url(new Uint8Array(digest))
  return { verifier, challenge }
}

export async function exchangeCode(opts: {
  code: string
  clientId: string
  codeVerifier: string
  redirectUri: string
}): Promise<{ access_token: string; refresh_token?: string; expires_in?: number }> {
  const meta = await discoverOAuth()
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: opts.code,
    client_id: opts.clientId,
    code_verifier: opts.codeVerifier,
    redirect_uri: opts.redirectUri,
  })
  const res = await fetch(meta.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Token exchange failed (${res.status}): ${text}`)
  }
  return res.json()
}

function base64url(bytes: Uint8Array): string {
  let str = ""
  for (const b of bytes) str += String.fromCharCode(b)
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}
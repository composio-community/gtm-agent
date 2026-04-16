import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

export async function proxy(req: NextRequest) {
  let res = NextResponse.next({ request: req })

  const url = process.env.SUPABASE_URL
  const publishable = process.env.SUPABASE_PUBLISHABLE_KEY
  if (!url || !publishable) return res

  const supabase = createServerClient(url, publishable, {
    cookies: {
      getAll() {
        return req.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          req.cookies.set(name, value)
        }
        res = NextResponse.next({ request: req })
        for (const { name, value, options } of cookiesToSet) {
          res.cookies.set(name, value, options)
        }
      },
    },
  })

  // Refresh the session cookie and read the current user.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = req.nextUrl.pathname
  const isPublic =
    pathname === "/login" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/cron/") ||
    pathname.startsWith("/api/oauth/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"

  if (!user && !isPublic) {
    const loginUrl = req.nextUrl.clone()
    loginUrl.pathname = "/login"
    loginUrl.searchParams.set("next", pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (user && pathname === "/login") {
    const home = req.nextUrl.clone()
    home.pathname = "/kanban"
    home.search = ""
    return NextResponse.redirect(home)
  }

  return res
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
}

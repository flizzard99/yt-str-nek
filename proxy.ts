import { NextResponse, type NextRequest } from "next/server"
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth"

export async function proxy(request: NextRequest) {
  const { pathname, origin } = request.nextUrl
  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)

  if (pathname === "/login" && session) {
    return NextResponse.redirect(new URL("/mod", origin))
  }

  if (pathname.startsWith("/mod") && !session) {
    const url = new URL("/login", origin)
    url.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/login", "/mod/:path*"],
}
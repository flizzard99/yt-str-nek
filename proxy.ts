import { NextResponse, type NextRequest } from "next/server"
// Importa lib/session y no lib/auth a propósito: así el proxy no arrastra
// Prisma. Aquí solo se hace una comprobación optimista del token; cada ruta
// y cada API vuelven a validar la sesión por su cuenta.
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session"

const PROTECTED = ["/mod", "/player", "/users"]

export async function proxy(request: NextRequest) {
  const { pathname, origin } = request.nextUrl
  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)

  if (pathname === "/login" && session) {
    return NextResponse.redirect(new URL("/", origin))
  }

  if (PROTECTED.some((p) => pathname.startsWith(p)) && !session) {
    const url = new URL("/login", request.nextUrl.origin)
    url.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/login", "/mod/:path*", "/player/:path*", "/users/:path*"],
}
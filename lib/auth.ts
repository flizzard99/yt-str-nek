import { cookies } from "next/headers"
import { SignJWT, jwtVerify } from "jose"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

export const SESSION_COOKIE = "ytstrnek.session"
const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 días

export interface SessionUser {
  id: string
  username: string
  role: string
}

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET
  if (!secret) {
    throw new Error("AUTH_SECRET no está configurada")
  }
  return new TextEncoder().encode(secret)
}

export async function createSession(user: SessionUser): Promise<void> {
  const token = await new SignJWT({
    id: user.id,
    username: user.username,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecret())

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  })
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

/** Verifica un token JWT y devuelve la sesión, o null si es inválido. */
export async function verifySessionToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, getSecret())
    return {
      id: payload.id as string,
      username: payload.username as string,
      role: payload.role as string,
    }
  } catch {
    return null
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  return verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value)
}

/** Verifica credenciales contra la base de datos. Devuelve null si no coinciden. */
export async function verifyCredentials(
  username: string,
  password: string
): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({ where: { username } })
  if (!user) return null

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) return null

  return { id: user.id, username: user.username, role: user.role }
}
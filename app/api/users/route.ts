import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const MIN_PASSWORD = 8

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      username: true,
      role: true,
      createdAt: true,
      _count: { select: { addedBy: true } },
    },
  })

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      username: u.username,
      role: u.role,
      createdAt: u.createdAt,
      songsAdded: u._count.addedBy,
      isSelf: u.id === session.id,
    })),
  })
}

/** Crea un usuario nuevo. */
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const username = typeof body.username === "string" ? body.username.trim() : ""
  const password = typeof body.password === "string" ? body.password : ""

  if (!username) {
    return NextResponse.json({ error: "Falta el nombre de usuario" }, { status: 400 })
  }
  if (username.length > 32) {
    return NextResponse.json(
      { error: "El nombre de usuario es demasiado largo" },
      { status: 400 }
    )
  }
  if (password.length < MIN_PASSWORD) {
    return NextResponse.json(
      { error: `La contraseña necesita al menos ${MIN_PASSWORD} caracteres` },
      { status: 400 }
    )
  }

  const existing = await prisma.user.findUnique({ where: { username } })
  if (existing) {
    return NextResponse.json(
      { error: "Ya existe un usuario con ese nombre" },
      { status: 409 }
    )
  }

  const user = await prisma.user.create({
    data: { username, password: await bcrypt.hash(password, 10) },
    select: { id: true, username: true, role: true, createdAt: true },
  })

  return NextResponse.json({ user: { ...user, songsAdded: 0, isSelf: false } }, { status: 201 })
}
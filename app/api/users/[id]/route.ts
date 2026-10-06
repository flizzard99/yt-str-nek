import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const MIN_PASSWORD = 8

type Params = { params: Promise<{ id: string }> }

/** Cambia el nombre de usuario o la contraseña. */
export async function PATCH(req: Request, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const newUsername =
    typeof body.username === "string" ? body.username.trim() : undefined
  const newPassword =
    typeof body.password === "string" && body.password.length > 0
      ? body.password
      : undefined

  if (newUsername === undefined && newPassword === undefined) {
    return NextResponse.json(
      { error: "No hay nada que cambiar" },
      { status: 400 }
    )
  }

  if (newUsername !== undefined) {
    if (!newUsername) {
      return NextResponse.json(
        { error: "El nombre de usuario no puede quedar vacío" },
        { status: 400 }
      )
    }
    if (newUsername.length > 32) {
      return NextResponse.json(
        { error: "El nombre de usuario es demasiado largo" },
        { status: 400 }
      )
    }

    const clash = await prisma.user.findUnique({ where: { username: newUsername } })
    if (clash && clash.id !== id) {
      return NextResponse.json(
        { error: "Ese nombre ya está en uso" },
        { status: 409 }
      )
    }
  }

  if (newPassword !== undefined && newPassword.length < MIN_PASSWORD) {
    return NextResponse.json(
      { error: `La contraseña necesita al menos ${MIN_PASSWORD} caracteres` },
      { status: 400 }
    )
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(newUsername !== undefined ? { username: newUsername } : {}),
      ...(newPassword !== undefined
        ? { password: await bcrypt.hash(newPassword, 10) }
        : {}),
    },
    select: { id: true, username: true, role: true, createdAt: true },
  })

  return NextResponse.json({
    user: { ...user, songsAdded: 0, isSelf: user.id === session.id },
  })
}

/** Elimina un usuario. No se puede borrar a uno mismo ni quedarse sin ninguno. */
export async function DELETE(req: Request, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params

  if (id === session.id) {
    return NextResponse.json(
      { error: "No puedes eliminar tu propio usuario" },
      { status: 400 }
    )
  }

  const existing = await prisma.user.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Ese usuario no existe" }, { status: 404 })
  }

  const total = await prisma.user.count()
  if (total <= 1) {
    return NextResponse.json(
      { error: "No se puede quedar la aplicación sin usuarios" },
      { status: 400 }
    )
  }

  // addedById tiene onDelete implícito restrictivo: primero se sueltan las
  // referencias para poder borrar el usuario.
  await prisma.$transaction([
    prisma.queueItem.updateMany({ where: { addedById: id }, data: { addedById: null } }),
    prisma.historyItem.updateMany({ where: { addedById: id }, data: { addedById: null } }),
    prisma.user.delete({ where: { id } }),
  ])

  return NextResponse.json({ ok: true })
}
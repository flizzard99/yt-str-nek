import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { renumberQueue } from "@/lib/songs"

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params

  const item = await prisma.queueItem.delete({ where: { id } }).catch(() => null)
  if (!item) {
    return NextResponse.json({ error: "La canción no está en la cola" }, { status: 404 })
  }

  await renumberQueue()
  return NextResponse.json({ ok: true })
}
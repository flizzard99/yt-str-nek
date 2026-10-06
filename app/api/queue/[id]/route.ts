import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  try {
    const { id } = await params
    await prisma.queueItem.delete({ where: { id } })

    // Recalcular posiciones
    const remaining = await prisma.queueItem.findMany({
      orderBy: { position: "asc" },
      select: { id: true },
    })

    for (let i = 0; i < remaining.length; i++) {
      await prisma.queueItem.update({
        where: { id: remaining[i].id },
        data: { position: i + 1 },
      })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 })
  }
}
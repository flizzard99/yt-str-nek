import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  try {
    const first = await prisma.queueItem.findFirst({
      orderBy: { position: "asc" },
      include: { song: true, addedBy: { select: { username: true } } },
    })

    if (!first) {
      return NextResponse.json({ error: "La cola está vacía" }, { status: 400 })
    }

    await prisma.historyItem.create({
      data: {
        requesterName: first.requesterName,
        addedById: first.addedById,
        addedByName: first.addedBy?.username ?? null,
        songId: first.songId,
      },
    })

    await prisma.queueItem.delete({ where: { id: first.id } })

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

    return NextResponse.json({ ok: true, played: first })
  } catch {
    return NextResponse.json({ error: "Error al avanzar la cola" }, { status: 500 })
  }
}
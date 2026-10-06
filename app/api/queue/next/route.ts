import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { renumberQueue } from "@/lib/songs"

/** Marca la primera canción como reproducida y la mueve al historial. */
export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

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
  await renumberQueue()

  return NextResponse.json({ ok: true, played: first })
}
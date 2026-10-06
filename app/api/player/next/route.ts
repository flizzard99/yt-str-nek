import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { renumberQueue } from "@/lib/songs"
import { verifyPlayerKey } from "@/lib/player"

/**
 * Marca la canción actual como reproducida y avanza a la siguiente.
 * Lo usa el reproductor del streamer.
 */
export async function POST(req: Request) {
  if (!verifyPlayerKey(req)) {
    return NextResponse.json({ error: "Clave inválida" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const finishedId = typeof body.queueItemId === "string" ? body.queueItemId : null

  // Solo avanza si el id coincide con lo que el reproductor tiene en pantalla,
  // para no saltarse una canción que un mod acaba de añadir por delante.
  if (finishedId) {
    const playing = await prisma.queueItem.findUnique({
      where: { id: finishedId },
      include: { addedBy: { select: { username: true } } },
    })

    if (!playing) {
      return NextResponse.json({ error: "Esa canción ya no está en la cola" }, { status: 409 })
    }

    await prisma.historyItem.create({
      data: {
        requesterName: playing.requesterName,
        addedById: playing.addedById,
        addedByName: playing.addedBy?.username ?? null,
        songId: playing.songId,
      },
    })

    await prisma.queueItem.delete({ where: { id: playing.id } })
    await renumberQueue()
  }

  return NextResponse.json({ ok: true })
}
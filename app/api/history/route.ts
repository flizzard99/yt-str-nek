import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const history = await prisma.historyItem.findMany({
    include: {
      song: true,
    },
    orderBy: {
      playedAt: "desc",
    },
    take: 20,
  })

  return NextResponse.json({ history })
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  try {
    const body = await req.json()
    const { songId, youtubeId, title, channel, thumbnail, durationSec, requesterName } = body

    let song = await prisma.song.findUnique({
      where: { youtubeId },
    })

    if (!song && youtubeId) {
      song = await prisma.song.create({
        data: { youtubeId, title, channel, thumbnail, durationSec: durationSec ?? null },
      })
    }

    if (!song && songId) {
      song = await prisma.song.findUnique({ where: { id: songId } })
    }

    if (!song) return NextResponse.json({ error: "Canción no encontrada" }, { status: 400 })

    const queueCount = await prisma.queueItem.count()
    if (queueCount >= 20) {
      return NextResponse.json({ error: "La cola está llena (máx. 20 canciones)" }, { status: 400 })
    }

    const lastPos = await prisma.queueItem.aggregate({
      _max: { position: true },
    })
    const nextPos = (lastPos._max.position || 0) + 1

    const item = await prisma.queueItem.create({
      data: {
        position: nextPos,
        requesterName: requesterName || null,
        addedById: session.id,
        songId: song.id,
      },
      include: {
        song: true,
        addedBy: { select: { id: true, username: true } },
      },
    })

    return NextResponse.json({ item }, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Error al añadir desde historial" }, { status: 500 })
  }
}

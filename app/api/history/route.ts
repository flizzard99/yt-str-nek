import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { MAX_QUEUE, nextQueuePosition, upsertSong } from "@/lib/songs"

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

/** Reañade una canción del historial al final de la cola. */
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const historyId = typeof body.id === "string" ? body.id : null
  if (!historyId) {
    return NextResponse.json({ error: "Cancción no indicada" }, { status: 400 })
  }

  const queueCount = await prisma.queueItem.count()
  if (queueCount >= MAX_QUEUE) {
    return NextResponse.json(
      { error: `La cola está llena (máx. ${MAX_QUEUE} canciones)` },
      { status: 400 }
    )
  }

  const historyItem = await prisma.historyItem.findUnique({
    where: { id: historyId },
    include: { song: true },
  })
  if (!historyItem) {
    return NextResponse.json({ error: "La canción no está en el historial" }, { status: 404 })
  }

  const song = await upsertSong(historyItem.song.youtubeId)
  if (!song) {
    return NextResponse.json({ error: "El vídeo ya no está disponible" }, { status: 404 })
  }

  const item = await prisma.queueItem.create({
    data: {
      position: await nextQueuePosition(),
      requesterName: historyItem.requesterName,
      addedById: session.id,
      songId: song.id,
    },
    include: {
      song: true,
      addedBy: { select: { id: true, username: true } },
    },
  })

  return NextResponse.json({ item }, { status: 201 })
}
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyPlayerKey } from "@/lib/player"

export interface PlayerSong {
  queueItemId: string
  youtubeId: string
  title: string
  channel: string
  thumbnail: string
  durationSec: number | null
  requesterName: string | null
  upNext: number
}

/**
 * Estado del reproductor: la canción actual y cuántas van detrás.
 * No expone el resto de la cola.
 */
export async function GET(req: Request) {
  if (!verifyPlayerKey(req)) {
    return NextResponse.json({ error: "Clave inválida" }, { status: 401 })
  }

  const items = await prisma.queueItem.findMany({
    include: {
      song: true,
      addedBy: { select: { username: true } },
    },
    orderBy: { position: "asc" },
    take: 2,
  })

  const [current, ...rest] = items

  if (!current) {
    return NextResponse.json({ current: null, upNext: 0 })
  }

  const payload: PlayerSong = {
    queueItemId: current.id,
    youtubeId: current.song.youtubeId,
    title: current.song.title,
    channel: current.song.channel,
    thumbnail: current.song.thumbnail,
    durationSec: current.song.durationSec,
    requesterName: current.requesterName,
    upNext: rest.length,
  }

  return NextResponse.json({ current: payload, upNext: rest.length })
}
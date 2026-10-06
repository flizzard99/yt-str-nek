import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { addToQueueSchema } from "@/lib/validators"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const queue = await prisma.queueItem.findMany({
    include: {
      song: true,
      addedBy: { select: { id: true, username: true } },
    },
    orderBy: {
      position: "asc",
    },
  })

  return NextResponse.json({ queue })
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  try {
    const body = await req.json()
    const parsed = addToQueueSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })
    }

    const { youtubeId, requesterName } = parsed.data

    const existingSong = await prisma.song.findUnique({ where: { youtubeId } })
    if (!existingSong) {
      return NextResponse.json({ error: "Canción no encontrada. Resuelve la URL primero." }, { status: 400 })
    }

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
        songId: existingSong.id,
      },
      include: {
        song: true,
        addedBy: { select: { id: true, username: true } },
      },
    })

    return NextResponse.json({ item }, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Error al añadir a la cola" }, { status: 500 })
  }
}
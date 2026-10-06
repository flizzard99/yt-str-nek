import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { reorderQueueSchema } from "@/lib/validators"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  try {
    const body = await req.json()
    const parsed = reorderQueueSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })
    }

    for (const item of parsed.data.items) {
      await prisma.queueItem.update({
        where: { id: item.id },
        data: { position: item.position },
      })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Error al reordenar" }, { status: 500 })
  }
}
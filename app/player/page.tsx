import { Player } from "@/components/player/player"

// La página se lee desde OBS en cada cambio de cola, así que nunca se cachea.
export const dynamic = "force-dynamic"

export default async function PlayerPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>
}) {
  const { key } = await searchParams
  return <Player playerKey={key ?? ""} />
}
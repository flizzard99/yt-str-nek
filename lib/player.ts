import { timingSafeEqual } from "crypto"

/**
 * El reproductor público (/player) no usa sesión de moderador, porque el
 * streamer lo deja abierto en OBS. Para que la URL no baste para alterar la
 * cola, las acciones de escritura exigen una clave compartida.
 */

export function verifyPlayerKey(request: Request): boolean {
  const expected = process.env.PLAYER_KEY
  // Sin clave configurada se permite, para desarrollo local.
  if (!expected) return true

  const url = new URL(request.url)
  const provided =
    url.searchParams.get("key") ?? request.headers.get("x-player-key")

  if (!provided) return false

  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
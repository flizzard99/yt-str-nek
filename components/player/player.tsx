"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import {
  CirclePlay,
  Pause,
  Play,
  SkipForward,
  Volume2,
  VolumeX,
  SkipBack,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { formatDuration } from "@/lib/format"
import type { PlayerSong } from "@/app/api/player/current/route"
import type { YTNamespace, YTPlayer, YTEventTarget } from "@/types/youtube-iframe"

declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

const API_SRC = "https://www.youtube.com/iframe_api"

let apiPromise: Promise<YTNamespace> | null = null

/** Carga la API IFrame de YouTube una sola vez. */
function loadYouTubeApi(): Promise<YTNamespace> {
  if (apiPromise) return apiPromise

  apiPromise = new Promise((resolve, reject) => {
    if (window.YT?.Player) {
      resolve(window.YT)
      return
    }

    window.onYouTubeIframeAPIReady = () => {
      if (window.YT?.Player) resolve(window.YT)
    }

    const existing = document.querySelector(`script[src="${API_SRC}"]`)
    if (existing) return

    const script = document.createElement("script")
    script.src = API_SRC
    script.async = true
    script.onerror = () => reject(new Error("No se pudo cargar la API de YouTube"))
    document.head.appendChild(script)
  })

  return apiPromise
}

export function Player({ playerKey }: { playerKey: string }) {
  const [current, setCurrent] = useState<PlayerSong | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [needsGesture, setNeedsGesture] = useState(false)

  const holderRef = useRef<HTMLDivElement | null>(null)
  const playerRef = useRef<YTPlayer | null>(null)
  const currentIdRef = useRef<string | null>(null)
  // Permite que los callbacks del player disparen advance() sin depender del orden
  const advanceRef = useRef<(() => Promise<void>) | null>(null)

  const authedFetch = useCallback(
    (url: string, init?: RequestInit) => {
      const separator = url.includes("?") ? "&" : "?"
      return fetch(`${url}${separator}key=${encodeURIComponent(playerKey)}`, init)
    },
    [playerKey]
  )

  const loadCurrent = useCallback(async () => {
    try {
      const res = await authedFetch("/api/player/current")
      if (res.status === 401) {
        toast.error("Clave del reproductor inválida")
        return
      }
      const data = await res.json()
      setCurrent(data.current)
    } catch {
      toast.error("No se pudo consultar la cola")
    } finally {
      setLoading(false)
    }
  }, [authedFetch])

  /** Crea el reproductor cuando llega la primera canción. */
  const buildPlayer = useCallback(
    async (youtubeId: string, startMuted: boolean) => {
      const YT = await loadYouTubeApi()
      if (!holderRef.current) return

      playerRef.current?.destroy()

      const node = document.createElement("div")
      node.id = `yt-${Math.random().toString(36).slice(2)}`
      holderRef.current.appendChild(node)

      playerRef.current = new YT.Player(node, {
        videoId: youtubeId,
        playerVars: {
          autoplay: 1,
          playsinline: 1,
          controls: 1,
          rel: 0,
          modestbranding: 1,
        },
        events: {
          onReady: (event: { target: YTEventTarget }) => {
            // El navegador solo permite reproducción automática con sonido si
            // hubo interacción previa. Se arranca silenciado y luego se
            // activa el volumen; si lo bloquea, se pide un clic.
            try {
              event.target.mute()
              event.target.playVideo()
              if (!startMuted) event.target.unMute()
              setIsPlaying(true)
            } catch {
              setNeedsGesture(true)
            }
          },
          onStateChange: (event: { data: number }) => {
            if (event.data === YT.PlayerState.PLAYING) setIsPlaying(true)
            if (event.data === YT.PlayerState.PAUSED) setIsPlaying(false)
            if (event.data === YT.PlayerState.ENDED) void advanceRef.current?.()
          },
        },
      })
    },
     
    []
  )

  const advance = useCallback(async () => {
    const finishedId = currentIdRef.current
    try {
      const res = await authedFetch("/api/player/next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queueItemId: finishedId }),
      })
      if (!res.ok && res.status !== 409) {
        toast.error("No se pudo avanzar la cola")
      }
    } catch {
      toast.error("No se pudo avanzar la cola")
    } finally {
      // Fuerza la recarga para cargar la siguiente canción
      currentIdRef.current = null
      playerRef.current?.destroy()
      playerRef.current = null
      if (holderRef.current) holderRef.current.innerHTML = ""
      setCurrent(null)
      await loadCurrent()
    }
  }, [authedFetch, loadCurrent])

  // Registra advance para los callbacks del player
  useEffect(() => {
    advanceRef.current = advance
  }, [advance])

  // Primera carga
  useEffect(() => {
    // El setState ocurre tras el await, no de forma síncrona en el efecto.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCurrent()
  }, [loadCurrent])

  // Cuando llega una canción nueva, se monta el reproductor
  useEffect(() => {
    if (!current || currentIdRef.current === current.youtubeId) return
    currentIdRef.current = current.youtubeId
    void buildPlayer(current.youtubeId, false)
  }, [current, buildPlayer])

  // Mantiene la cola al día
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void loadCurrent()
    }, 5000)
    return () => clearInterval(id)
  }, [loadCurrent])

  function togglePlay() {
    const player = playerRef.current
    if (!player) return
    if (isPlaying) {
      player.pauseVideo()
      setIsPlaying(false)
    } else {
      player.playVideo()
      setIsPlaying(true)
    }
  }

  function toggleMute() {
    const player = playerRef.current
    if (!player) return
    if (player.isMuted()) {
      player.unMute()
      player.setVolume(100)
      setMuted(false)
      setNeedsGesture(false)
    } else {
      player.mute()
      setMuted(true)
    }
  }

  function seek(delta: number) {
    const player = playerRef.current
    if (!player || !current?.durationSec) return
    const target = Math.max(0, Math.min(current.durationSec, player.getCurrentTime() + delta))
    player.seekTo(target, true)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Cargando cola…
      </div>
    )
  }

  if (!current) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="max-w-md text-center">
          <CardContent className="space-y-2 py-10">
            <p className="font-heading text-lg">No hay música en la cola</p>
            <p className="text-sm text-muted-foreground">
              Cuando un moderador añada una canción aparecerá aquí.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-4 p-4">
      <Card>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            {current.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={current.thumbnail}
                alt=""
                className="h-24 w-40 shrink-0 rounded-lg object-cover"
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-lg font-semibold">{current.title}</p>
              <p className="truncate text-sm text-muted-foreground">{current.channel}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDuration(current.durationSec)}
                {current.requesterName && ` · pedido por ${current.requesterName}`}
              </p>
            </div>
          </div>

          {/* Reproductor de YouTube, oculto: controlamos el audio con la API */}
          <div ref={holderRef} className="hidden" aria-hidden="true" />

          {needsGesture && (
            <Button className="w-full" size="lg" onClick={togglePlay}>
              <CirclePlay />
              Activar reproducción
            </Button>
          )}

          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button variant="outline" size="lg" onClick={() => seek(-10)} aria-label="Retroceder 10 segundos">
              <SkipBack />
              10
            </Button>
            <Button size="lg" onClick={togglePlay} aria-label={isPlaying ? "Pausar" : "Reproducir"}>
              {isPlaying ? <Pause /> : <Play />}
              {isPlaying ? "Pausa" : "Reproducir"}
            </Button>
            <Button variant="outline" size="lg" onClick={() => seek(10)} aria-label="Avanzar 10 segundos">
              10
              <SkipForward />
            </Button>
            <Button variant="outline" size="icon-lg" onClick={toggleMute} aria-label={muted ? "Activar sonido" : "Silenciar"}>
              {muted ? <VolumeX /> : <Volume2 />}
            </Button>
            <Button variant="secondary" size="lg" onClick={() => void advance()}>
              <SkipForward />
              Saltar
            </Button>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            {current.upNext > 0
              ? `${current.upNext} canción${current.upNext > 1 ? "es" : ""} siguiente${current.upNext > 1 ? "s" : ""} en la cola`
              : "No hay más canciones en la cola"}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CirclePlay, Home, Pause, Play, SkipForward, Volume2, VolumeX } from "lucide-react"
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
const DEFAULT_VOLUME = 80

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

    if (document.querySelector(`script[src="${API_SRC}"]`)) return

    const script = document.createElement("script")
    script.src = API_SRC
    script.async = true
    script.onerror = () => reject(new Error("No se pudo cargar la API de YouTube"))
    document.head.appendChild(script)
  })

  return apiPromise
}

export function Player() {
  const router = useRouter()
  const [current, setCurrent] = useState<PlayerSong | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(DEFAULT_VOLUME)
  const [needsGesture, setNeedsGesture] = useState(false)
  const [position, setPosition] = useState({ current: 0, total: 0 })

  const holderRef = useRef<HTMLDivElement | null>(null)
  const playerRef = useRef<YTPlayer | null>(null)
  // Identidad por item de cola: dos entradas con el mismo vídeo son distintas
  const loadedIdRef = useRef<string | null>(null)
  const volumeRef = useRef(DEFAULT_VOLUME)
  const advanceRef = useRef<(() => Promise<void>) | null>(null)
  const ytRef = useRef<YTNamespace | null>(null)
  const watchdogRef = useRef<number | null>(null)
  const scrubbingRef = useRef(false)

  const loadCurrent = useCallback(async () => {
    try {
      const res = await fetch("/api/player/current")
      if (res.status === 401) {
        router.replace("/login?callbackUrl=/player")
        return
      }
      const data = await res.json()
      setCurrent(data.current)
    } catch {
      toast.error("No se pudo consultar la cola")
    } finally {
      setLoading(false)
    }
  }, [router])

  const advance = useCallback(async () => {
    const finishedId = loadedIdRef.current
    if (!finishedId) return

    try {
      const res = await fetch("/api/player/next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queueItemId: finishedId }),
      })

      // Si el servidor no confirmó el avance no se toca el reproductor: si no,
      // se recargaría la misma canción y el bucle no terminaría nunca.
      if (!res.ok) return

      await loadCurrent()
    } catch {
      toast.error("No se pudo avanzar la cola")
    }
  }, [loadCurrent])

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current !== null) {
      window.clearInterval(watchdogRef.current)
      watchdogRef.current = null
    }
  }, [])

  /**
   * La IFrame API no lanza error cuando el navegador bloquea el autoplay: se
   * limita a no cambiar de estado. Por eso no basta con llamar a playVideo(),
   * hay que comprobar que la canción se está reproduciendo de verdad.
   */
  const startWatchdog = useCallback(
    (songId: string) => {
      clearWatchdog()
      let tries = 0

      watchdogRef.current = window.setInterval(() => {
        tries += 1
        const player = playerRef.current
        const YT = ytRef.current
        // Si ya se está montando otra canción, este vigilante se descarta
        if (!player || !YT || loadedIdRef.current !== songId) {
          clearWatchdog()
          return
        }

        if (player.getPlayerState() === YT.PlayerState.PLAYING) {
          clearWatchdog()
          return
        }

        if (tries >= 10) {
          clearWatchdog()
          setIsPlaying(false)
          setNeedsGesture(true)
        }
      }, 200)
    },
    [clearWatchdog]
  )

  /** Crea el reproductor para una canción. */
  const buildPlayer = useCallback(async (song: PlayerSong) => {
    const YT = await loadYouTubeApi()
    if (!holderRef.current) return

    ytRef.current = YT
    clearWatchdog()
    playerRef.current?.destroy()
    if (holderRef.current) holderRef.current.innerHTML = ""

    const node = document.createElement("div")
    holderRef.current.appendChild(node)

    setIsPlaying(false)
    setNeedsGesture(false)

    playerRef.current = new YT.Player(node, {
      videoId: song.youtubeId,
      // El tamaño lo manda el contenedor, así el vídeo se adapta al ancho
      // sin recalcular nada al cambiar de modo.
      width: "100%",
      height: "100%",
      playerVars: {
        autoplay: 1,
        playsinline: 1,
        controls: 0,
        rel: 0,
        start: 0,
      },
      events: {
        onReady: (event: { target: YTEventTarget }) => {
          // Los navegadores bloquean el autoplay con sonido si el visitante no
          // ha interactuado antes. Se arranca silenciado, que sí está permitido,
          // y el sonido se activa después cuando se confirme que está sonando.
          event.target.mute()
          event.target.setVolume(volumeRef.current)
          event.target.playVideo()
          startWatchdog(song.queueItemId)
        },
        onStateChange: (event: { data: number }) => {
          if (event.data === YT.PlayerState.PLAYING) {
            clearWatchdog()
            setIsPlaying(true)
            setNeedsGesture(false)
            // Solo si el volumen no está a 0: si el usuario lo silenció a
            // propósito, no se le quita el silencio.
            if (volumeRef.current > 0) playerRef.current?.unMute()
          }
          if (event.data === YT.PlayerState.PAUSED) setIsPlaying(false)
          if (event.data === YT.PlayerState.ENDED) void advanceRef.current?.()
        },
        onError: () => {
          clearWatchdog()
          setIsPlaying(false)
          setNeedsGesture(true)
        },
      },
    })
  }, [clearWatchdog, startWatchdog])

  useEffect(() => {
    advanceRef.current = advance
  }, [advance])

  // Limpia el vigilante y el reproductor al salir de la página
  useEffect(() => {
    return () => {
      if (watchdogRef.current !== null) window.clearInterval(watchdogRef.current)
      playerRef.current?.destroy()
    }
  }, [])

  // Primera carga
  useEffect(() => {
    // El setState ocurre tras el await, no de forma síncrona en el efecto.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCurrent()
  }, [loadCurrent])

  // Monta el reproductor solo cuando cambia el item de la cola
  useEffect(() => {
    if (!current) return
    if (loadedIdRef.current === current.queueItemId) return
    loadedIdRef.current = current.queueItemId
    void buildPlayer(current)
  }, [current, buildPlayer])

  // Mantiene la cola al día. Sondea siempre, también con la pestaña oculta: si
  // no, una pestaña minimizada dejaría de reproducir y la cola no avanzaría.
useEffect(() => {
    const id = setInterval(() => void loadCurrent(), 5000)

    // Al volver al frente, se consulta de inmediato en lugar de esperar al
    // siguiente intervalo.
    const onVisible = () => {
      if (document.visibilityState === "visible") void loadCurrent()
    }
    document.addEventListener("visibilitychange", onVisible)

    return () => {
      clearInterval(id)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [loadCurrent])

  // Sigue la posición para mover la barra de avance. Mientras el usuario la
  // arrastra no se toca, para que no salte bajo su dedo.
  useEffect(() => {
    const id = setInterval(() => {
      const player = playerRef.current
      if (!player || scrubbingRef.current) return
      const total = player.getDuration()
      if (!Number.isFinite(total) || total <= 0) return
      setPosition({ current: player.getCurrentTime(), total })
    }, 500)

    return () => clearInterval(id)
  }, [])

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

  function changeVolume(next: number) {
    const value = Math.max(0, Math.min(100, next))
    setVolume(value)
    volumeRef.current = value

    const player = playerRef.current
    if (!player) return

    if (value === 0) {
      player.mute()
    } else {
      player.unMute()
      player.setVolume(value)
    }
  }

  function seekTo(seconds: number) {
    const player = playerRef.current
    if (!player) return
    const total = player.getDuration()
    if (!Number.isFinite(total)) return
    const clamped = Math.max(0, Math.min(total, seconds))
    player.seekTo(clamped, true)
    setPosition({ current: clamped, total })
  }

  function onScrubStart() {
    scrubbingRef.current = true
  }

  function onScrubEnd(seconds: number) {
    scrubbingRef.current = false
    seekTo(seconds)
  }

  const isMuted = volume === 0
  const [showVideo, setShowVideo] = useState(false)

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
        <Card className="max-w-md text-center border-2 border-border/60">
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
      <div className="flex justify-center">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <Home className="h-4 w-4" />
          Cambiar de modo
        </Link>
      </div>

      <Card>
        <CardContent className="space-y-5">
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

          {/* Reproductor de YouTube oculto: el audio y el volumen los controlamos con la API */}
          {/*
            En modo audio el contenedor se esconde pero NO con display:none: un
            iframe de tamaño cero puede dejar de reproducir. Se deja de 1x1 y
            transparente, así el audio sigue sonando.
          */}
          <div
            ref={holderRef}
            aria-hidden={!showVideo}
            className={
              showVideo
                ? "aspect-video w-full overflow-hidden rounded-lg bg-black"
                : "pointer-events-none fixed bottom-0 left-0 h-px w-px overflow-hidden opacity-0"
            }
          />

          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              variant={showVideo ? "secondary" : "outline"}
              size="sm"
              onClick={() => setShowVideo((v) => !v)}
            >
              {showVideo ? "Solo audio" : "Mostrar vídeo"}
            </Button>
          </div>

          {needsGesture && (
            <Button className="w-full" size="lg" onClick={togglePlay}>
              <CirclePlay />
              Activar reproducción
            </Button>
          )}

          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button size="lg" onClick={togglePlay} aria-label={isPlaying ? "Pausar" : "Reproducir"}>
              {isPlaying ? <Pause /> : <Play />}
              {isPlaying ? "Pausar" : "Reproducir"}
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => void advance()}
              aria-label="Saltar a la siguiente"
            >
              <SkipForward />
              Saltar
            </Button>
          </div>

          <div className="space-y-1.5">
            <input
              type="range"
              min={0}
              max={Math.max(1, Math.round(position.total))}
              step={1}
              value={Math.round(position.current)}
              onChange={(e) => setPosition((p) => ({ ...p, current: Number(e.target.value) }))}
              onPointerDown={onScrubStart}
              onPointerUp={(e) => onScrubEnd(Number(e.currentTarget.value))}
              onKeyUp={(e) => {
                // El teclado no dispara pointerup: hay que cerrar el arrastre
                // a mano o la barra se queda congelada.
                if (e.currentTarget.value !== undefined) onScrubEnd(Number(e.currentTarget.value))
              }}
              onBlur={(e) => onScrubEnd(Number(e.currentTarget.value))}
              disabled={position.total <= 0}
              aria-label="Posición de la canción"
              aria-valuetext={`${formatDuration(Math.round(position.current))} de ${formatDuration(Math.round(position.total))}`}
              className="h-2 w-full cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-50"
            />
            <div className="flex justify-between text-xs tabular-nums text-muted-foreground">
              <span>{formatDuration(Math.round(position.current))}</span>
              <span>
                {formatDuration(position.total > 0 ? Math.round(position.total) : null)}
              </span>
            </div>
          </div>

          <div className="flex items-end justify-center gap-3 pt-2">
            <Button
              variant="ghost"
              size="icon-lg"
              onClick={() => changeVolume(isMuted ? DEFAULT_VOLUME : 0)}
              aria-label={isMuted ? "Activar sonido" : "Silenciar"}
            >
              {isMuted ? <VolumeX /> : <Volume2 />}
            </Button>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={volume}
              onChange={(e) => changeVolume(Number(e.target.value))}
              aria-label="Volumen"
              aria-valuetext={`${volume}%`}
              // writing-mode gira el deslizador: max arriba, min abajo
              style={{ writingMode: "vertical-lr", direction: "rtl" }}
              className="h-28 w-2 cursor-pointer accent-primary"
            />
            <span className="w-10 shrink-0 pb-1 text-right text-sm tabular-nums text-muted-foreground">
              {volume}%
            </span>
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
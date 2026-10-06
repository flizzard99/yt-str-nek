import Link from "next/link"
import { Flower2, Headphones, ShieldCheck } from "lucide-react"
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"

export const metadata = {
  title: "yt-str-nek",
  description: "Gestor de cola de música para moderadores",
}

const MODES = [
  {
    href: "/mod",
    title: "Modo moderador",
    description:
      "Gestiona la cola: busca canciones, añade enlaces, elimina, reordena y marca lo que ya sonó.",
    icon: ShieldCheck,
  },
  {
    href: "/player",
    title: "Modo streamer",
    description:
      "Reproductor con la canción actual, control de volumen y avance al terminar.",
    icon: Headphones,
  },
]

export default function Home() {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-8 p-6">
      <div className="text-center">
        <Flower2 className="mx-auto mb-3 h-12 w-12 text-primary" />
        <h1 className="font-heading text-3xl font-semibold">yt-str-nek</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Elige cómo quieres entrar
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {MODES.map((mode) => (
          <Link key={mode.href} href={mode.href} className="group">
            <Card className="h-full transition-colors group-hover:border-primary/60">
              <CardContent className="space-y-2 py-6">
                <mode.icon className="h-7 w-7 text-primary" />
                <CardTitle className="font-heading text-lg">{mode.title}</CardTitle>
                <CardDescription>{mode.description}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Ambas vistas requieren iniciar sesión.
      </p>
    </div>
  )
}
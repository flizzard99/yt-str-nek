"use client"

import { History as HistoryIcon, Loader2, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatTimeAgo } from "@/lib/format"
import type { HistoryItem } from "@/types"

export function HistoryList({
  history,
  onReAdd,
  disabled,
}: {
  history: HistoryItem[]
  onReAdd: (item: HistoryItem) => void
  disabled: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <HistoryIcon className="h-4 w-4 text-primary" />
          Historial
        </CardTitle>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Aún no hay canciones reproducidas.
          </p>
        ) : (
          <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto pr-1">
            {history.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-accent/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium" title={item.song.title}>
                    {item.song.title}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.requesterName ? `pedido por ${item.requesterName} · ` : ""}
                    {formatTimeAgo(item.playedAt)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                  aria-label="Añadir de nuevo"
                  disabled={disabled}
                  onClick={() => onReAdd(item)}
                >
                  {disabled ? <Loader2 className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
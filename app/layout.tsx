import type { Metadata } from "next"
import { Inter, Noto_Serif_JP } from "next/font/google"
import "./globals.css"
import { Providers } from "@/components/providers"
import { SakuraPetals } from "@/components/sakura/sakura-petals"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

const notoSerifJP = Noto_Serif_JP({
  subsets: ["latin"],
  variable: "--font-noto-serif-jp",
  weight: ["400", "500", "600", "700"],
})

export const metadata: Metadata = {
  title: "yt-str-nek",
  description: "Gestor de cola de música para moderadores",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.variable} ${notoSerifJP.variable} font-sans antialiased`}>
        <Providers>
          <SakuraPetals />
          <div className="relative z-10">{children}</div>
        </Providers>
      </body>
    </html>
  )
}
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { SITE_URL } from '@/lib/site'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

const TITULO = 'Beraca — Baldosas, cerámicas y porcelanatos'
const DESCRIPCION =
  'Catálogo de baldosas, cerámicas y porcelanatos. Consulta medidas, acabados y precios, ' +
  'arma tu pedido y envíalo por WhatsApp.'

export const metadata: Metadata = {
  // Convierte las rutas relativas de abajo en absolutas, como exigen
  // Open Graph y las etiquetas canónicas.
  metadataBase: new URL(SITE_URL),

  title: {
    default: TITULO,
    // Las páginas internas quedan como "Productos · Beraca".
    template: '%s · Beraca',
  },
  description: DESCRIPCION,
  applicationName: 'Beraca',

  keywords: [
    'baldosas',
    'cerámicas',
    'porcelanatos',
    'pisos',
    'enchapes',
    'Colombia',
  ],

  alternates: {
    canonical: '/',
  },

  openGraph: {
    type: 'website',
    locale: 'es_CO',
    url: '/',
    siteName: 'Beraca',
    title: TITULO,
    description: DESCRIPCION,
  },

  twitter: {
    card: 'summary_large_image',
    title: TITULO,
    description: DESCRIPCION,
  },

  robots: {
    index: true,
    follow: true,
  },
}

/**
 * Sin esto el móvil dibuja la página como si midiera 980 px y luego la
 * encoge: todo sale diminuto. `maximumScale` no se toca a propósito, para
 * no impedir que alguien amplíe.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1d4ed8',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <div className="min-h-screen bg-gray-50">
          {children}
        </div>
      </body>
    </html>
  )
}

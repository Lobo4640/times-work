import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Times Work · Tiempo de Trabajo',
  description: 'Registro de jornada laboral inalterable con blindaje legal. GPS + Auditoría.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Times Work',
  },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' }
    ],
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'Times Work · Tiempo de Trabajo',
    description: 'Control de jornada con blindaje legal',
    type: 'website',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#000000',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className="dark">
      <body className="grain bg-black overflow-hidden h-screen font-sans">
        <div className="flex flex-col h-screen max-w-md mx-auto relative shadow-2xl border-x border-white/5">
          {children}
        </div>
        
        {/* Registro del Service Worker simplificado */}
        <script 
          dangerouslySetInnerHTML={{ 
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(reg) {
                    console.log('SW registrado');
                  }).catch(function(err) {
                    console.log('SW error:', err);
                  });
                });
              }
            ` 
          }} 
        />
      </body>
    </html>
  )
}

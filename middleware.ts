import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Si no hay sesión y el usuario no está ya en el login, redirigir a /profile (donde está tu login)
  // OJO: Cambia '/profile' por la ruta exacta donde tengas el formulario de las capturas
  if (!session && !req.nextUrl.pathname.startsWith('/profile')) {
    return NextResponse.redirect(new URL('/profile', req.url))
  }

  return res
}

// Configura en qué rutas debe actuar el portero
export const config = {
  matcher: ['/clock/:path*', '/history/:path*', '/'], 
}

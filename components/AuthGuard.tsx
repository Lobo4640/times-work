// components/AuthGuard.tsx
'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import ProfilePage from '@/app/profile/page' // Importamos tu página de perfil que ya tiene el login
import { Loader2 } from 'lucide-react'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 1. Verificar sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    // 2. Escuchar cambios en el estado de autenticación (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Pantalla de carga de seguridad
  if (loading) {
    return (
      <div className="h-screen w-full bg-black flex flex-col items-center justify-center gap-4 z-[999] relative">
        <Loader2 className="w-10 h-10 text-gold animate-spin" />
        <p className="text-gold font-mono text-[10px] tracking-[0.3em]">BLOQUEO_DE_SEGURIDAD...</p>
      </div>
    )
  }

  // SI NO HAY SESIÓN: Mostramos ÚNICAMENTE la pantalla de Login/Registro
  // Tu ProfilePage ya maneja este estado, así que la reutilizamos aquí.
  if (!session) {
    return (
      <div className="h-screen w-full bg-black overflow-hidden relative z-[998]">
        <ProfilePage />
      </div>
    )
  }

  // SI HAY SESIÓN: Renderizamos la App normal (children)
  return <>{children}</>
}

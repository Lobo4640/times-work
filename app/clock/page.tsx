'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Satellite, Play, Pause, Square, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import BottomNav from '@/components/BottomNav'
import Logo from '@/components/Logo'
import { supabase } from '@/lib/supabase'
import {
  formatDurationWithSeconds,
  ClockState,
  saveClockState,
  loadClockState,
  clearClockState,
  computeElapsed,
  generateSessionId,
} from '@/lib/timeUtils'

export default function ClockPage() {
  const router = useRouter()
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [state, setState] = useState<ClockState>({
    status: 'idle',
    sessionId: null,
    startTimestamp: null,
    pauseStartTimestamp: null,
    totalPausedSeconds: 0,
    elapsedSeconds: 0,
    lastEventId: null,
  })
  
  const [display, setDisplay] = useState('00:00:00')
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'acquiring' | 'fixed' | 'error'>('idle')
  const [gpsCoords, setGpsCoords] = useState<{latitude: number, longitude: number, accuracy: number} | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const [loading, setLoading] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // --- PROTECCIÓN DE RUTA ---
  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          router.push('/profile') 
        } else {
          setIsAuthLoading(false)
        }
      } catch (e) {
        router.push('/profile')
      }
    }
    checkUser()
  }, [router])

  // Lógica del cronómetro (Solo se activa si el usuario está autenticado)
  useEffect(() => {
    if (isAuthLoading) return
    
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (state.status === 'running' || state.status === 'paused') {
      intervalRef.current = setInterval(() => {
        const elapsed = computeElapsed(state)
        setDisplay(formatDurationWithSeconds(elapsed))
      }, 1000)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [state, isAuthLoading])

  // Carga inicial de estado
  useEffect(() => {
    if (isAuthLoading) return
    const saved = loadClockState()
    if (saved && saved.status !== 'ended' && saved.status !== 'idle') {
      setState(saved)
    }
  }, [isAuthLoading])

  // Funciones de Supabase
  async function logToSupabase(sid: string, type: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('time_logs').insert({
      user_id: user.id,
      session_id: sid,
      event_type: type,
      timestamp: new Date().toISOString()
    })
  }

  // Handlers
  const handleStart = async () => {
    setLoading(true)
    const sid = generateSessionId()
    const newState: ClockState = { ...state, status: 'running', sessionId: sid, startTimestamp: Date.now() }
    setState(newState)
    await logToSupabase(sid, 'start')
    setLoading(false)
  }

  const handleEnd = async () => {
    const finalElapsed = computeElapsed(state)
    setState({ ...state, status: 'ended', elapsedSeconds: finalElapsed })
    await logToSupabase(state.sessionId!, 'end')
    setTimeout(() => {
      clearClockState()
      router.refresh() // Refresca para limpiar el estado
    }, 2000)
  }

  // Render de seguridad
  if (isAuthLoading) {
    return (
      <div className="h-screen w-full bg-black flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-gold animate-spin mb-4" />
        <p className="text-gold font-mono text-[10px] tracking-[0.3em]">SECURE_ACCESS_CHECK</p>
      </div>
    )
  }

  const [hh, mm, ss] = display.split(':')

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-black text-white font-body">
      <div className="flex-1 relative flex flex-col px-6 py-6">
        <Logo size="sm" showText />
        
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
           <div className="flex items-baseline font-mono">
              <span className="text-8xl font-bold clock-digit animate-pulse-glow">{hh}</span>
              <span className="text-6xl mx-1 opacity-50 animate-tick">:</span>
              <span className="text-8xl font-bold clock-digit animate-pulse-glow">{mm}</span>
              <span className="text-4xl ml-2 opacity-30 self-end mb-3">{ss}</span>
           </div>
        </div>

        <div className="space-y-4 pb-20">
          {state.status === 'idle' && (
            <button onClick={handleStart} className="w-full h-16 rounded-2xl bg-green-700 font-bold uppercase active:scale-95 transition-all">
              Iniciar Jornada
            </button>
          )}
          {state.status !== 'idle' && (
             <button onClick={handleEnd} className="w-full h-16 rounded-2xl bg-red-700 font-bold uppercase active:scale-95 transition-all">
              Finalizar
            </button>
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  )
}

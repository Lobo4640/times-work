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

  // --- PROTECCIÓN DE RUTA (Verifica si el usuario está logueado) ---
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        // Si no hay sesión, lo mandamos al perfil (login)
        router.push('/profile') 
      } else {
        // Si hay sesión, dejamos de mostrar la pantalla de carga
        setIsAuthLoading(false)
      }
    }
    checkUser()
  }, [router])

  // Cargar estado guardado
  useEffect(() => {
    if (isAuthLoading) return
    const saved = loadClockState()
    if (saved && saved.status !== 'ended' && saved.status !== 'idle') {
      setState(saved)
    }
  }, [isAuthLoading])

  // GPS inicial
  useEffect(() => {
    if (isAuthLoading) return
    const getLocation = async () => {
      setGpsStatus('acquiring')
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsCoords({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy
          })
          setGpsStatus('fixed')
        },
        () => setGpsStatus('error'),
        { enableHighAccuracy: true }
      )
    }
    getLocation()
  }, [isAuthLoading])

  // Lógica del cronómetro
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (state.status === 'running' || state.status === 'paused') {
      intervalRef.current = setInterval(() => {
        const elapsed = computeElapsed(state)
        setDisplay(formatDurationWithSeconds(elapsed))
      }, 1000)
    } else {
      setDisplay(formatDurationWithSeconds(state.elapsedSeconds))
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [state])

  // Guardar estado automáticamente
  useEffect(() => {
    if (state.status !== 'idle') saveClockState(state)
  }, [state])

  // Eventos de botones
  async function handleStart() {
    if (loading) return
    setLoading(true)
    const sid = generateSessionId()
    const newState: ClockState = {
      status: 'running',
      sessionId: sid,
      startTimestamp: Date.now(),
      pauseStartTimestamp: null,
      totalPausedSeconds: 0,
      elapsedSeconds: 0,
      lastEventId: null,
    }
    setState(newState)
    await logToSupabase(sid, 'start')
    setLoading(false)
  }

  async function handlePause() {
    if (state.status !== 'running') return
    const newState: ClockState = {
      ...state,
      status: 'paused',
      pauseStartTimestamp: Date.now(),
      elapsedSeconds: computeElapsed(state),
    }
    setState(newState)
    await logToSupabase(state.sessionId!, 'pause')
  }

  async function handleResume() {
    if (state.status !== 'paused') return
    const pausedSecs = state.pauseStartTimestamp ? Math.floor((Date.now() - state.pauseStartTimestamp) / 1000) : 0
    const newState: ClockState = {
      ...state,
      status: 'running',
      pauseStartTimestamp: null,
      totalPausedSeconds: state.totalPausedSeconds + pausedSecs,
    }
    setState(newState)
    await logToSupabase(state.sessionId!, 'resume')
  }

  async function handleEnd() {
    const finalElapsed = computeElapsed(state)
    setState({ ...state, status: 'ended', elapsedSeconds: finalElapsed })
    await logToSupabase(state.sessionId!, 'end')
    setTimeout(() => {
      clearClockState()
      setState({ status: 'idle', sessionId: null, startTimestamp: null, pauseStartTimestamp: null, totalPausedSeconds: 0, elapsedSeconds: 0, lastEventId: null })
      setDisplay('00:00:00')
    }, 2000)
  }

  async function logToSupabase(sid: string, type: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('time_logs').insert({
      user_id: user.id, session_id: sid, event_type: type,
      latitude: gpsCoords?.latitude, longitude: gpsCoords?.longitude,
      timestamp: new Date().toISOString()
    })
  }

  // --- RENDERIZADO ---

  if (isAuthLoading) {
    return (
      <div className="h-screen w-full bg-black flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-gold animate-spin mb-4" />
        <p className="text-gold font-mono text-[10px] tracking-widest">VERIFICANDO SESIÓN...</p>
      </div>
    )
  }

  const [hh, mm, ss] = display.split(':')

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-black text-white font-body">
      <div className="flex-1 relative flex flex-col px-6 py-6">
        <div className="flex justify-between items-center z-10">
          <Logo size="sm" showText />
          <div className={`px-3 py-1 rounded-full text-[10px] font-bold border ${gpsStatus === 'fixed' ? 'border-cyan-active/30 text-cyan-active' : 'border-white/10 text-white/40'}`}>
            {gpsStatus === 'fixed' ? 'GPS_OK' : 'BUSCANDO_GPS...'}
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-6 z-10">
           <div className="text-[10px] tracking-[0.4em] uppercase text-white/30 font-bold">
              {state.status === 'running' ? '● Jornada Activa' : state.status === 'paused' ? '⏸ En Pausa' : '○ Standby'}
           </div>
           <div className="flex items-baseline font-mono">
              <span className={`text-8xl font-bold ${state.status === 'running' ? 'clock-digit animate-pulse-glow' : state.status === 'paused' ? 'clock-digit-paused' : 'text-white/20'}`}>{hh}</span>
              <span className="text-6xl mx-1 opacity-50 animate-tick">:</span>
              <span className={`text-8xl font-bold ${state.status === 'running' ? 'clock-digit animate-pulse-glow' : state.status === 'paused' ? 'clock-digit-paused' : 'text-white/20'}`}>{mm}</span>
              <span className="text-4xl ml-2 opacity-30 self-end mb-3">{ss}</span>
           </div>
        </div>

        <div className="space-y-4 pb-20 z-10">
          {state.status === 'idle' && (
            <button onClick={handleStart} className="w-full h-16 rounded-2xl bg-green-700 font-bold uppercase tracking-widest active:scale-95 transition-all">
              Iniciar Jornada
            </button>
          )}
          {state.status === 'running' && (
            <div className="flex gap-3">
              <button onClick={handlePause} className="flex-1 h-16 rounded-2xl bg-amber-600 font-bold uppercase active:scale-95 transition-all">Pausa</button>
              <button onClick={handleEnd} className="flex-1 h-16 rounded-2xl bg-red-700 font-bold uppercase active:scale-95 transition-all">Finalizar</button>
            </div>
          )}
          {state.status === 'paused' && (
            <div className="flex gap-3">
              <button onClick={handleResume} className="flex-1 h-16 rounded-2xl bg-green-700 font-bold uppercase active:scale-95 transition-all">Reanudar</button>
              <button onClick={handleEnd} className="flex-1 h-16 rounded-2xl bg-red-700 font-bold uppercase active:scale-95 transition-all">Finalizar</button>
            </div>
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  )
}

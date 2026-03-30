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
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('idle')
  const [gpsCoords, setGpsCoords] = useState<GeoData | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const [loading, setLoading] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const notifiedRef = useRef({ at4h: false, at8h: false })

  // --- PROTECCIÓN DE RUTA (SIN MIDDLEWARE) ---
  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          router.push('/profile') 
        } else {
          setIsAuthLoading(false)
        }
      } catch (error) {
        router.push('/profile')
      }
    }
    checkUser()
  }, [router])

  // Carga de estado persistido
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
    setGpsStatus('acquiring')
    getLocation().then(geo => {
      if (geo) { setGpsCoords(geo); setGpsStatus('fixed') }
      else setGpsStatus('error')
    })
  }, [isAuthLoading])

  // Lógica del segundero
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

  // Persistencia local
  useEffect(() => {
    if (state.status !== 'idle') saveClockState(state)
  }, [state])

  // Funciones de Geolocalización
  async function getLocation(): Promise<GeoData | null> {
    return new Promise(resolve => {
      if (typeof window === 'undefined' || !navigator.geolocation) { resolve(null); return }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000 }
      )
    })
  }

  // Funciones de eventos
  async function handleStart() {
    if (loading) return
    setLoading(true)
    const geo = await getLocation()
    const sessionId = generateSessionId()
    const newState: ClockState = {
      status: 'running',
      sessionId,
      startTimestamp: Date.now(),
      pauseStartTimestamp: null,
      totalPausedSeconds: 0,
      elapsedSeconds: 0,
      lastEventId: null,
    }
    setState(newState)
    await logEvent(sessionId, 'start', geo)
    showToast('Jornada iniciada ✓', 'ok')
    setLoading(false)
  }

  async function handlePause() {
    if (loading || state.status !== 'running') return
    setLoading(true)
    const geo = await getLocation()
    const newState: ClockState = {
      ...state,
      status: 'paused',
      pauseStartTimestamp: Date.now(),
      elapsedSeconds: computeElapsed(state),
    }
    setState(newState)
    await logEvent(state.sessionId!, 'pause', geo)
    showToast('Pausa registrada ✓', 'ok')
    setLoading(false)
  }

  async function handleResume() {
    if (loading || state.status !== 'paused') return
    setLoading(true)
    const geo = await getLocation()
    const pausedDuration = state.pauseStartTimestamp ? Math.floor((Date.now() - state.pauseStartTimestamp) / 1000) : 0
    const newState: ClockState = {
      ...state,
      status: 'running',
      pauseStartTimestamp: null,
      totalPausedSeconds: state.totalPausedSeconds + pausedDuration,
    }
    setState(newState)
    await logEvent(state.sessionId!, 'resume', geo)
    showToast('Jornada reanudada ✓', 'ok')
    setLoading(false)
  }

  async function handleEnd() {
    if (loading || state.status === 'idle') return
    setLoading(true)
    const geo = await getLocation()
    const finalElapsed = computeElapsed(state)
    setState({ ...state, status: 'ended', elapsedSeconds: finalElapsed })
    await logEvent(state.sessionId!, 'end', geo)
    showToast('Jornada finalizada ✓', 'ok')
    setTimeout(() => {
      clearClockState()
      setState({ status: 'idle', sessionId: null, startTimestamp: null, pauseStartTimestamp: null, totalPausedSeconds: 0, elapsedSeconds: 0, lastEventId: null })
      setDisplay('00:00:00')
    }, 3000)
    setLoading(false)
  }

  async function logEvent(sid: string, type: string, geo: GeoData | null) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('time_logs').insert({
      user_id: user.id, session_id: sid, event_type: type,
      latitude: geo?.latitude, longitude: geo?.longitude, accuracy: geo?.accuracy,
      timestamp: new Date().toISOString(), server_timestamp: new Date().toISOString()
    })
  }

  function showToast(msg: string, type: 'ok' | 'err') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Pantalla de carga mientras verifica sesión
  if (isAuthLoading) {
    return (
      <div className="h-screen w-full bg-black flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 text-gold animate-spin" />
        <p className="text-gold font-mono tracking-[0.3em] text-[10px]">AUTH_CHECKING...</p>
      </div>
    )
  }

  const [hh, mm, ss] = display.split(':')

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-black grain text-white font-body">
      <div className="flex-1 relative flex flex-col px-6 py-4">
        {/* Logo y GPS */}
        <div className="flex justify-between items-center z-10">
          <Logo size="sm" showText />
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all ${gpsStatus === 'fixed' ? 'border-cyan-active/30 bg-cyan-active/10 text-cyan-active' : 'border-white/10 text-white/40'}`}>
            <Satellite size={12} className={gpsStatus === 'fixed' ? 'animate-pulse' : ''} />
            {gpsStatus === 'fixed' ? 'SATELLITE_FIX' : 'GPS_SEARCH...'}
          </div>
        </div>

        {/* Reloj */}
        <div className="flex-1 flex flex-col items-center justify-center gap-8 z-10">
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

        {/* Botonera */}
        <div className="space-y-4 pb-24 z-10">
          {state.status === 'idle' && (
            <button onClick={handleStart} disabled={loading} className="w-full h-16 rounded-2xl bg-gradient-to-br from-green-600 to-green-800 font-bold tracking-widest uppercase active:scale-95 transition-all flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(22,163,74,0.2)]">
              <Play fill="white" size={20} /> Iniciar Jornada
            </button>
          )}

          {state.status === 'running' && (
            <div className="flex gap-3">
              <button onClick={handlePause} className="flex-1 h-16 rounded-2xl bg-amber-600 font-bold tracking-widest uppercase active:scale-95 transition-all flex items-center justify-center gap-2">
                <Pause fill="white" size={20} /> Pausa
              </button>
              <button onClick={handleEnd} className="flex-1 h-16 rounded-2xl bg-red-600 font-bold tracking-widest uppercase active:scale-95 transition-all flex items-center justify-center gap-2">
                <Square fill="white" size={20} /> Finalizar
              </button>
            </div>
          )}

          {state.status === 'paused' && (
            <div className="flex gap-3">
              <button onClick={handleResume} className="flex-1 h-16 rounded-2xl bg-green-600 font-bold tracking-widest uppercase active:scale-95 transition-all flex items-center justify-center gap-2">
                <Play fill="white" size={20} /> Reanudar
              </button>
              <button onClick={handleEnd} className="flex-1 h-16 rounded-2xl bg-red-600 font-bold tracking-widest uppercase active:scale-95 transition-all flex items-center justify-center gap-2">
                <Square fill="white" size={20} /> Finalizar
              </button>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className="absolute bottom-24 left-6 right-6 p-4 rounded-xl backdrop-blur-xl border border-white/10 flex items-center gap-3 animate-slide-up z-50 bg-surface-card/80">
          {toast.type === 'ok' ? <CheckCircle className="text-green-500" size={18} /> : <AlertCircle className="text-red-500" size={18} />}
          <span className="text-sm font-medium">{toast.msg}</span>
        </div>
      )}

      <BottomNav />
    </div>
  )
}

// Tipos locales para evitar errores de compilación
type GpsStatus = 'idle' | 'acquiring' | 'fixed' | 'error'
interface GeoData { latitude: number; longitude: number; accuracy: number }

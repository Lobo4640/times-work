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

export const dynamic = 'force-dynamic'

type GpsStatus = 'idle' | 'acquiring' | 'fixed' | 'error'

interface GeoData {
  latitude: number
  longitude: number
  accuracy: number
}

async function getLocation(): Promise<GeoData | null> {
  return new Promise(resolve => {
    if (!navigator.geolocation) { resolve(null); return }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000 }
    )
  })
}

async function logEvent(
  sessionId: string,
  eventType: 'start' | 'pause' | 'resume' | 'end',
  geo: GeoData | null
) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('time_logs').insert({
    user_id: user.id,
    session_id: sessionId,
    event_type: eventType,
    latitude: geo?.latitude ?? null,
    longitude: geo?.longitude ?? null,
    accuracy: geo?.accuracy ?? null,
    timestamp: new Date().toISOString(),
    server_timestamp: new Date().toISOString(),
  })
}

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

  // --- PROTECCIÓN DE RUTA ---
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/profile') // Ajusta esta ruta a tu pantalla de Login
      } else {
        setIsAuthLoading(false)
      }
    }
    checkUser()
  }, [router])

  // Load persisted state
  useEffect(() => {
    if (isAuthLoading) return
    const saved = loadClockState()
    if (saved && saved.status !== 'ended' && saved.status !== 'idle') {
      setState(saved)
      notifiedRef.current = { at4h: false, at8h: false }
    }
  }, [isAuthLoading])

  // Acquire GPS on mount
  useEffect(() => {
    if (isAuthLoading) return
    setGpsStatus('acquiring')
    getLocation().then(geo => {
      if (geo) { setGpsCoords(geo); setGpsStatus('fixed') }
      else setGpsStatus('error')
    })
  }, [isAuthLoading])

  // Tick logic
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)

    if (state.status === 'running' || state.status === 'paused') {
      intervalRef.current = setInterval(() => {
        const elapsed = computeElapsed(state)
        setDisplay(formatDurationWithSeconds(elapsed))

        if (state.status === 'running') {
          if (elapsed >= 13500 && !notifiedRef.current.at4h) { // 3h 45min
            notifiedRef.current.at4h = true
            sendNotification('⏰ Aviso: 15min para descanso', 'Art. 34 ET')
          }
          if (elapsed >= 27900 && !notifiedRef.current.at8h) { // 7h 45min
            notifiedRef.current.at8h = true
            sendNotification('⏰ Aviso: 15min para fin de jornada', 'RD 8/2019')
          }
        }
      }, 1000)
    } else {
      setDisplay(formatDurationWithSeconds(state.elapsedSeconds))
    }

    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [state])

  // Persist state
  useEffect(() => {
    if (state.status !== 'idle') saveClockState(state)
  }, [state])

  function sendNotification(title: string, body: string) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body })
    }
  }

  function showToast(msg: string, type: 'ok' | 'err') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function handleStart() {
    if (loading) return
    setLoading(true)
    const geo = gpsCoords ?? await getLocation()
    if (geo) { setGpsCoords(geo); setGpsStatus('fixed') }

    const sessionId = generateSessionId()
    const now = Date.now()
    const newState: ClockState = {
      status: 'running',
      sessionId,
      startTimestamp: now,
      pauseStartTimestamp: null,
      totalPausedSeconds: 0,
      elapsedSeconds: 0,
      lastEventId: null,
    }
    setState(newState)
    await logEvent(sessionId, 'start', geo)
    if ('Notification' in window) Notification.requestPermission()
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
    const pausedDuration = state.pauseStartTimestamp
      ? Math.floor((Date.now() - state.pauseStartTimestamp) / 1000)
      : 0

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
    if (loading || state.status === 'idle' || state.status === 'ended') return
    setLoading(true)
    const geo = await getLocation()
    const finalElapsed = computeElapsed(state)
    const newState: ClockState = { ...state, status: 'ended', elapsedSeconds: finalElapsed }
    setState(newState)
    await logEvent(state.sessionId!, 'end', geo)
    showToast('Jornada finalizada ✓', 'ok')

    setTimeout(() => {
      clearClockState()
      setState({
        status: 'idle', sessionId: null, startTimestamp: null,
        pauseStartTimestamp: null, totalPausedSeconds: 0, elapsedSeconds: 0, lastEventId: null,
      })
      setDisplay('00:00:00')
    }, 3000)
    setLoading(false)
  }

  if (isAuthLoading) {
    return (
      <div className="h-screen w-full bg-black flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 text-gold animate-spin" />
        <p className="text-gold font-display tracking-widest text-sm">VERIFICANDO IDENTIDAD</p>
      </div>
    )
  }

  const digitClass = state.status === 'running'
    ? 'clock-digit animate-pulse-glow'
    : state.status === 'paused'
    ? 'clock-digit-paused'
    : 'clock-digit-stopped'

  const [hh, mm, ss] = display.split(':')

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-black grain">
      <div className="flex-1 relative flex flex-col px-6 py-4">
        {/* Glow Effects */}
        <div className={`absolute inset-0 pointer-events-none transition-opacity duration-1000 ${state.status === 'running' ? 'opacity-100' : 'opacity-0'}`}
          style={{ background: 'radial-gradient(circle at 50% 50%, rgba(0,229,255,0.07) 0%, transparent 70%)' }} />
        
        <div className="flex justify-between items-center z-10">
          <Logo size="sm" showText />
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all ${gpsStatus === 'fixed' ? 'border-cyan-active/30 bg-cyan-active/10 text-cyan-active' : 'border-white/10 text-white/40'}`}>
            <Satellite size={12} className={gpsStatus === 'fixed' ? 'animate-pulse' : ''} />
            {gpsStatus === 'fixed' ? 'GPS FIJADO' : 'BUSCANDO GPS...'}
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-8 z-10">
           <div className="text-[10px] tracking-[0.4em] uppercase text-white/40 font-bold">
              {state.status === 'running' ? '● Jornada Activa' : state.status === 'paused' ? '⏸ En Pausa' : '○ Standby'}
           </div>

           <div className="flex items-baseline font-mono">
              <span className={digitClass + " text-8xl"}>{hh}</span>
              <span className="text-6xl mx-1 opacity-50 animate-tick">:</span>
              <span className={digitClass + " text-8xl"}>{mm}</span>
              <span className="text-4xl ml-2 opacity-30 self-end mb-3">{ss}</span>
           </div>

           {gpsCoords && state.status !== 'idle' && (
             <div className="text-[10px] font-mono text-white/20 bg-white/5 px-3 py-1 rounded-full border border-white/5">
               {gpsCoords.latitude.toFixed(5)}, {gpsCoords.longitude.toFixed(5)} (±{Math.round(gpsCoords.accuracy)}m)
             </div>
           )}
        </div>

        <div className="space-y-4 pb-24 z-10">
          {state.status === 'idle' && (
            <button onClick={handleStart} disabled={loading} className="w-full h-16 rounded-2xl bg-gradient-to-br from-green-600 to-green-800 text-white font-bold tracking-widest uppercase shadow-[0_0_30px_rgba(22,163,74,0.3)] active:scale-95 transition-all flex items-center justify-center gap-3">
              <Play fill="white" size={20} /> Iniciar Jornada
            </button>
          )}

          {state.status === 'running' && (
            <div className="flex gap-3">
              <button onClick={handlePause} className="flex-1 h-16 rounded-2xl bg-amber-600 text-white font-bold tracking-widest uppercase active:scale-95 transition-all flex items-center justify-center gap-2">
                <Pause fill="white" size={20} /> Pausa
              </button>
              <button onClick={handleEnd} className="flex-1 h-16 rounded-2xl bg-red-600 text-white font-bold tracking-widest uppercase active:scale-95 transition-all flex items-center justify-center gap-2">
                <Square fill="white" size={20} /> Finalizar
              </button>
            </div>
          )}

          {state.status === 'paused' && (
            <div className="flex gap-3">
              <button onClick={handleResume} className="flex-1 h-16 rounded-2xl bg-green-600 text-white font-bold tracking-widest uppercase active:scale-95 transition-all flex items-center justify-center gap-2">
                <Play fill="white" size={20} /> Reanudar
              </button>
              <button onClick={handleEnd} className="flex-1 h-16 rounded-2xl bg-red-600 text-white font-bold tracking-widest uppercase active:scale-95 transition-all flex items-center justify-center gap-2">
                <Square fill="white" size={20} /> Finalizar
              </button>
            </div>
          )}

          <p className="text-[9px] text-center text-white/20 tracking-tighter uppercase font-medium">
            Registro Legal RD 8/2019 • Encriptación AES-256 • Geo-Verificado
          </p>
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

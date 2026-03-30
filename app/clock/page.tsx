 'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Satellite, Play, Pause, Square, AlertCircle, CheckCircle } from 'lucide-react'
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

  // Load persisted state
  useEffect(() => {
    const saved = loadClockState()
    if (saved && saved.status !== 'ended' && saved.status !== 'idle') {
      setState(saved)
      notifiedRef.current = { at4h: false, at8h: false }
    }
  }, [])

  // Acquire GPS on mount
  useEffect(() => {
    setGpsStatus('acquiring')
    getLocation().then(geo => {
      if (geo) { setGpsCoords(geo); setGpsStatus('fixed') }
      else setGpsStatus('error')
    })
  }, [])

  // Tick
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)

    if (state.status === 'running' || state.status === 'paused') {
      intervalRef.current = setInterval(() => {
        const elapsed = computeElapsed(state)
        setDisplay(formatDurationWithSeconds(elapsed))

        // Push notifications via Service Worker
        if (state.status === 'running') {
          if (elapsed >= 3 * 3600 + 45 * 60 && !notifiedRef.current.at4h) {
            notifiedRef.current.at4h = true
            sendNotification('⏰ Aviso: 15min para las 4 horas de jornada', 'Recuerda tu derecho a descanso (Art. 34 ET)')
          }
          if (elapsed >= 7 * 3600 + 45 * 60 && !notifiedRef.current.at8h) {
            notifiedRef.current.at8h = true
            sendNotification('⏰ Aviso: 15min para las 8 horas de jornada', 'Jornada máxima legal próxima (RD 8/2019)')
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
      new Notification(title, { body, icon: '/icon.png', badge: '/icon.png' })
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
    notifiedRef.current = { at4h: false, at8h: false }

    await logEvent(sessionId, 'start', geo)
    if ('Notification' in window) Notification.requestPermission()
    showToast('Jornada iniciada ✓', 'ok')
    setLoading(false)
  }

  async function handlePause() {
    if (loading || state.status !== 'running') return
    setLoading(true)
    const geo = await getLocation()

    const now = Date.now()
    const newState: ClockState = {
      ...state,
      status: 'paused',
      pauseStartTimestamp: now,
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
    const newState: ClockState = {
      ...state,
      status: 'ended',
      elapsedSeconds: finalElapsed,
    }
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

  const digitClass = state.status === 'running'
    ? 'clock-digit animate-pulse-glow'
    : state.status === 'paused'
    ? 'clock-digit-paused'
    : 'clock-digit-stopped'

  const [hh, mm, ss] = display.split(':')

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Main content */}
      <div className="flex-1 relative overflow-hidden bg-black">
        {/* Background glow */}
        {state.status === 'running' && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at 50% 60%, rgba(0,229,255,0.06) 0%, transparent 65%)',
            }}
          />
        )}
        {state.status === 'paused' && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at 50% 60%, rgba(245,158,11,0.05) 0%, transparent 65%)',
            }}
          />
        )}

        {/* Watermark logo */}
        <div className="absolute top-0 right-0 left-0 flex justify-center pt-4 opacity-10 pointer-events-none select-none">
          <Logo size="xl" />
        </div>

        <div className="flex flex-col items-center justify-between h-full px-6 py-4 relative z-10">

          {/* Top bar */}
          <div className="w-full flex items-center justify-between pt-2">
            <Logo size="sm" showText />
            <div className="flex items-center gap-2">
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wider ${gpsStatus === 'fixed' ? 'animate-blink' : ''}`}
                style={{
                  background: gpsStatus === 'fixed' ? 'rgba(0,229,255,0.08)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${gpsStatus === 'fixed' ? 'rgba(0,229,255,0.3)' : 'rgba(255,255,255,0.08)'}`,
                  color: gpsStatus === 'fixed' ? '#00E5FF' : gpsStatus === 'error' ? '#EF4444' : '#6B7280',
                }}
              >
                <Satellite size={12} />
                <span>{gpsStatus === 'fixed' ? 'GPS Fijado' : gpsStatus === 'acquiring' ? 'Buscando...' : gpsStatus === 'error' ? 'Sin GPS' : 'GPS'}</span>
              </div>
            </div>
          </div>

          {/* Clock display */}
          <div className="flex flex-col items-center gap-4">
            {/* Status label */}
            <div
              className="text-xs tracking-[0.3em] uppercase font-medium"
              style={{
                color: state.status === 'running' ? '#00E5FF' : state.status === 'paused' ? '#F59E0B' : state.status === 'ended' ? '#10B981' : '#4A4A5A',
              }}
            >
              {state.status === 'running' ? '● Jornada Activa'
                : state.status === 'paused' ? '⏸ En Pausa'
                : state.status === 'ended' ? '✓ Jornada Finalizada'
                : '○ Sin Jornada Activa'}
            </div>

            {/* Giant clock */}
            <div className="flex items-baseline gap-1">
              <span className={`text-8xl font-black ${digitClass}`} style={{ fontFamily: 'var(--font-mono)' }}>
                {hh}
              </span>
              <span
                className="text-7xl font-black"
                style={{
                  fontFamily: 'var(--font-mono)',
                  color: state.status === 'running' ? '#00E5FF' : state.status === 'paused' ? '#F59E0B' : '#4A4A5A',
                  animation: state.status === 'running' ? 'tick 1s steps(1) infinite' : 'none',
                }}
              >
                :
              </span>
              <span className={`text-8xl font-black ${digitClass}`} style={{ fontFamily: 'var(--font-mono)' }}>
                {mm}
              </span>
              <span
                className="text-7xl font-black"
                style={{
                  fontFamily: 'var(--font-mono)',
                  color: state.status === 'running' ? '#00E5FF' : state.status === 'paused' ? '#F59E0B' : '#4A4A5A',
                  animation: state.status === 'running' ? 'tick 1s steps(1) infinite' : 'none',
                }}
              >
                :
              </span>
              <span
                className="text-5xl font-black"
                style={{
                  fontFamily: 'var(--font-mono)',
                  color: state.status === 'running' ? 'rgba(0,229,255,0.6)' : state.status === 'paused' ? 'rgba(245,158,11,0.6)' : '#2A2A3A',
                  alignSelf: 'flex-end',
                  marginBottom: '8px',
                }}
              >
                {ss}
              </span>
            </div>

            {/* HH:MM label */}
            <div className="text-[10px] tracking-[0.5em] uppercase" style={{ color: '#2A2A4A' }}>
              Horas · Minutos · Segundos
            </div>

            {/* GPS coords */}
            {gpsCoords && state.status !== 'idle' && (
              <div
                className="flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-full"
                style={{ background: 'rgba(0,229,255,0.04)', border: '1px solid rgba(0,229,255,0.1)', color: '#4A8A90' }}
              >
                <span>📍</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px' }}>
                  {gpsCoords.latitude.toFixed(4)}, {gpsCoords.longitude.toFixed(4)} ±{Math.round(gpsCoords.accuracy)}m
                </span>
              </div>
            )}
          </div>

          {/* Control buttons */}
          <div className="w-full space-y-3 pb-2">
            {state.status === 'idle' && (
              <button
                onClick={handleStart}
                disabled={loading}
                className="w-full h-16 rounded-2xl font-bold text-lg tracking-widest uppercase flex items-center justify-center gap-3 transition-all duration-200 active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, #16A34A, #15803D)',
                  boxShadow: '0 0 30px rgba(22,163,74,0.35), inset 0 1px 0 rgba(255,255,255,0.1)',
                  color: '#fff',
                }}
              >
                <Play size={22} fill="white" />
                Iniciar Jornada
              </button>
            )}

            {state.status === 'running' && (
              <div className="flex gap-3">
                <button
                  onClick={handlePause}
                  disabled={loading}
                  className="flex-1 h-16 rounded-2xl font-bold text-base tracking-widest uppercase flex items-center justify-center gap-2 transition-all duration-200 active:scale-95"
                  style={{
                    background: 'linear-gradient(135deg, #D97706, #B45309)',
                    boxShadow: '0 0 24px rgba(217,119,6,0.3)',
                    color: '#fff',
                  }}
                >
                  <Pause size={20} fill="white" />
                  Pausa
                </button>
                <button
                  onClick={handleEnd}
                  disabled={loading}
                  className="flex-1 h-16 rounded-2xl font-bold text-base tracking-widest uppercase flex items-center justify-center gap-2 transition-all duration-200 active:scale-95"
                  style={{
                    background: 'linear-gradient(135deg, #DC2626, #B91C1C)',
                    boxShadow: '0 0 24px rgba(220,38,38,0.3)',
                    color: '#fff',
                  }}
                >
                  <Square size={20} fill="white" />
                  Finalizar
                </button>
              </div>
            )}

            {state.status === 'paused' && (
              <div className="flex gap-3">
                <button
                  onClick={handleResume}
                  disabled={loading}
                  className="flex-1 h-16 rounded-2xl font-bold text-base tracking-widest uppercase flex items-center justify-center gap-2 transition-all duration-200 active:scale-95"
                  style={{
                    background: 'linear-gradient(135deg, #16A34A, #15803D)',
                    boxShadow: '0 0 24px rgba(22,163,74,0.3)',
                    color: '#fff',
                  }}
                >
                  <Play size={20} fill="white" />
                  Reanudar
                </button>
                <button
                  onClick={handleEnd}
                  disabled={loading}
                  className="flex-1 h-16 rounded-2xl font-bold text-base tracking-widest uppercase flex items-center justify-center gap-2 transition-all duration-200 active:scale-95"
                  style={{
                    background: 'linear-gradient(135deg, #DC2626, #B91C1C)',
                    boxShadow: '0 0 24px rgba(220,38,38,0.3)',
                    color: '#fff',
                  }}
                >
                  <Square size={20} fill="white" />
                  Finalizar
                </button>
              </div>
            )}

            {state.status === 'ended' && (
              <div
                className="w-full h-16 rounded-2xl flex items-center justify-center gap-3"
                style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', color: '#10B981' }}
              >
                <CheckCircle size={22} />
                <span className="font-bold tracking-widest uppercase">Jornada Registrada</span>
              </div>
            )}

            {/* Legal notice */}
            <div
              className="text-center text-xs py-2"
              style={{ color: '#2A2A4A', letterSpacing: '0.05em' }}
            >
              🔒 Registro inalterable · RD 8/2019 · GPS + Timestamp Servidor
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="absolute left-4 right-4 rounded-2xl px-4 py-3 flex items-center gap-2 text-sm font-medium animate-in"
          style={{
            bottom: '90px',
            zIndex: 50,
            background: toast.type === 'ok' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
            border: `1px solid ${toast.type === 'ok' ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`,
            color: toast.type === 'ok' ? '#10B981' : '#EF4444',
            backdropFilter: 'blur(12px)',
          }}
        >
          {toast.type === 'ok' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      <BottomNav />
    </div>
  )
}

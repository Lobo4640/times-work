'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  ClockState,
  saveClockState,
  loadClockState,
  clearClockState,
  computeElapsed,
  generateSessionId,
  formatDurationWithSeconds,
} from '@/lib/timeUtils'
import { supabase } from '@/lib/supabase'
import { useNotifications } from './useNotifications'

interface GeoData {
  latitude: number
  longitude: number
  accuracy: number
}

async function getLocation(): Promise<GeoData | null> {
  return new Promise(resolve => {
    if (!navigator.geolocation) { resolve(null); return }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    )
  })
}

export function useClock() {
  const [clockState, setClockState] = useState<ClockState>({
    status: 'idle',
    sessionId: null,
    startTimestamp: null,
    pauseStartTimestamp: null,
    totalPausedSeconds: 0,
    elapsedSeconds: 0,
    lastEventId: null,
  })
  const [display, setDisplay] = useState('00:00:00')
  const [gpsData, setGpsData] = useState<GeoData | null>(null)
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'acquiring' | 'fixed' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const { requestPermission, scheduleAlert, cancelAlerts } = useNotifications()

  // Load persisted state on mount
  useEffect(() => {
    const saved = loadClockState()
    if (saved && (saved.status === 'running' || saved.status === 'paused')) {
      setClockState(saved)
    }
  }, [])

  // Acquire GPS
  useEffect(() => {
    setGpsStatus('acquiring')
    getLocation().then(geo => {
      if (geo) { setGpsData(geo); setGpsStatus('fixed') }
      else setGpsStatus('error')
    })
  }, [])

  // Tick engine
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)

    if (clockState.status === 'running' || clockState.status === 'paused') {
      intervalRef.current = setInterval(() => {
        const elapsed = computeElapsed(clockState)
        setDisplay(formatDurationWithSeconds(elapsed))
      }, 500)
    } else {
      setDisplay(formatDurationWithSeconds(clockState.elapsedSeconds))
    }

    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [clockState])

  // Persist state
  useEffect(() => {
    if (clockState.status !== 'idle') saveClockState(clockState)
  }, [clockState])

  const logEvent = useCallback(async (
    sessionId: string,
    eventType: 'start' | 'pause' | 'resume' | 'end',
    geo: GeoData | null
  ) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Debes iniciar sesión para registrar la jornada'); return }

    const { error: insertError } = await supabase.from('time_logs').insert({
      user_id: user.id,
      session_id: sessionId,
      event_type: eventType,
      timestamp: new Date().toISOString(),
      server_timestamp: new Date().toISOString(),
      latitude: geo?.latitude ?? null,
      longitude: geo?.longitude ?? null,
      accuracy: geo?.accuracy ?? null,
    })

    if (insertError) setError(insertError.message)
  }, [])

  const start = useCallback(async () => {
    const geo = gpsData ?? await getLocation()
    if (geo && !gpsData) { setGpsData(geo); setGpsStatus('fixed') }

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

    setClockState(newState)
    await logEvent(sessionId, 'start', geo)
    await requestPermission()
    scheduleAlert(0, true)
  }, [gpsData, logEvent, requestPermission, scheduleAlert])

  const pause = useCallback(async () => {
    if (clockState.status !== 'running') return
    const geo = await getLocation()
    const now = Date.now()
    const currentElapsed = computeElapsed(clockState)

    setClockState(prev => ({
      ...prev,
      status: 'paused',
      pauseStartTimestamp: now,
      elapsedSeconds: currentElapsed,
    }))

    await logEvent(clockState.sessionId!, 'pause', geo)
  }, [clockState, logEvent])

  const resume = useCallback(async () => {
    if (clockState.status !== 'paused') return
    const geo = await getLocation()
    const pausedDuration = clockState.pauseStartTimestamp
      ? Math.floor((Date.now() - clockState.pauseStartTimestamp) / 1000)
      : 0

    setClockState(prev => ({
      ...prev,
      status: 'running',
      pauseStartTimestamp: null,
      totalPausedSeconds: prev.totalPausedSeconds + pausedDuration,
    }))

    await logEvent(clockState.sessionId!, 'resume', geo)
    scheduleAlert(clockState.elapsedSeconds, true)
  }, [clockState, logEvent, scheduleAlert])

  const end = useCallback(async () => {
    if (clockState.status === 'idle' || clockState.status === 'ended') return
    const geo = await getLocation()
    const finalElapsed = computeElapsed(clockState)

    setClockState(prev => ({
      ...prev,
      status: 'ended',
      elapsedSeconds: finalElapsed,
    }))

    await logEvent(clockState.sessionId!, 'end', geo)
    cancelAlerts()

    setTimeout(() => {
      clearClockState()
      setClockState({
        status: 'idle', sessionId: null, startTimestamp: null,
        pauseStartTimestamp: null, totalPausedSeconds: 0, elapsedSeconds: 0, lastEventId: null,
      })
    }, 3000)
  }, [clockState, logEvent, cancelAlerts])

  return {
    clockState,
    display,
    gpsData,
    gpsStatus,
    error,
    actions: { start, pause, resume, end },
  }
}

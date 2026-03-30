export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function formatDurationWithSeconds(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function formatTime(isoString: string): string {
  const d = new Date(isoString)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export interface ClockState {
  status: 'idle' | 'running' | 'paused' | 'ended'
  sessionId: string | null
  startTimestamp: number | null
  pauseStartTimestamp: number | null
  totalPausedSeconds: number
  elapsedSeconds: number
  lastEventId: string | null
}

const STORAGE_KEY = 'tw_clock_state'

export function saveClockState(state: ClockState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function loadClockState(): ClockState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ClockState
  } catch {
    return null
  }
}

export function clearClockState() {
  localStorage.removeItem(STORAGE_KEY)
}

export function computeElapsed(state: ClockState): number {
  if (!state.startTimestamp || state.status === 'idle') return 0
  if (state.status === 'ended') return state.elapsedSeconds

  const now = Date.now()
  const totalElapsed = Math.floor((now - state.startTimestamp) / 1000)
  let paused = state.totalPausedSeconds

  if (state.status === 'paused' && state.pauseStartTimestamp) {
    paused += Math.floor((now - state.pauseStartTimestamp) / 1000)
  }

  return Math.max(0, totalElapsed - paused)
}

export function generateSessionId(): string {
  return `ses_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

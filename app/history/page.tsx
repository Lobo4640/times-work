'use client'
import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, FileText, Download, Loader2, Calendar } from 'lucide-react'
import { format, startOfMonth, endOfMonth, parseISO, addMonths, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import BottomNav from '@/components/BottomNav'
import { supabase, TimeLog, Profile } from '@/lib/supabase'
import { generateDailyPDF, generateMonthlyPDF, shareBlob } from '@/lib/pdfGenerator'
import { formatDuration, formatTime } from '@/lib/timeUtils'
export const dynamic = 'force-dynamic';
interface DailyRecord {
  date: string
  sessionId: string
  events: TimeLog[]
  startTime: string | null
  endTime: string | null
  effectiveSeconds: number
  pauseSeconds: number
  totalSeconds: number
}

function buildDailyRecords(logs: TimeLog[]): DailyRecord[] {
  const bySession: Record<string, TimeLog[]> = {}
  for (const log of logs) {
    if (!bySession[log.session_id]) bySession[log.session_id] = []
    bySession[log.session_id].push(log)
  }

  const records: DailyRecord[] = []

  for (const [sessionId, events] of Object.entries(bySession)) {
    events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

    const startEvent = events.find(e => e.event_type === 'start')
    const endEvent = events.find(e => e.event_type === 'end')
    if (!startEvent) continue

    const date = startEvent.timestamp.slice(0, 10)
    const startTime = startEvent.timestamp
    const endTime = endEvent?.timestamp ?? null

    // Calculate pause time
    let pauseSeconds = 0
    let pauseStart: number | null = null
    for (const ev of events) {
      if (ev.event_type === 'pause') pauseStart = new Date(ev.timestamp).getTime()
      if (ev.event_type === 'resume' && pauseStart) {
        pauseSeconds += Math.floor((new Date(ev.timestamp).getTime() - pauseStart) / 1000)
        pauseStart = null
      }
    }

    const totalSeconds = endTime
      ? Math.floor((new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000)
      : 0
    const effectiveSeconds = Math.max(0, totalSeconds - pauseSeconds)

    records.push({ date, sessionId, events, startTime, endTime, effectiveSeconds, pauseSeconds, totalSeconds })
  }

  records.sort((a, b) => b.date.localeCompare(a.date))
  return records
}

export default function HistoryPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [records, setRecords] = useState<DailyRecord[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [pdfLoading, setPdfLoading] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd')
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd')

    const [logsRes, profileRes] = await Promise.all([
      supabase
        .from('time_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('timestamp', start + 'T00:00:00')
        .lte('timestamp', end + 'T23:59:59')
        .order('timestamp', { ascending: true }),
      supabase.from('profiles').select('*').eq('id', user.id).single(),
    ])

    setProfile(profileRes.data)
    setRecords(buildDailyRecords(logsRes.data ?? []))
    setLoading(false)
  }, [currentMonth])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleDailyPDF(record: DailyRecord) {
    setPdfLoading(record.sessionId)
    try {
      const session = {
        session_id: record.sessionId,
        date: record.date,
        start_time: record.startTime!,
        end_time: record.endTime,
        total_seconds: record.totalSeconds,
        pause_seconds: record.pauseSeconds,
        events: record.events,
      }
      const blob = await generateDailyPDF(session, profile!)
      const filename = `TimesWork_${record.date.replace(/-/g, '')}.pdf`
      shareBlob(blob, filename)
    } catch (e) { console.error(e) }
    setPdfLoading(null)
  }

  async function handleMonthlyPDF() {
    setPdfLoading('monthly')
    try {
      const monthStr = format(currentMonth, 'yyyy-MM')
      const sessions = records.map(r => ({
        session_id: r.sessionId,
        date: r.date,
        start_time: r.startTime!,
        end_time: r.endTime,
        total_seconds: r.totalSeconds,
        pause_seconds: r.pauseSeconds,
        events: r.events,
      }))
      const blob = await generateMonthlyPDF(sessions, profile!, monthStr)
      const filename = `TimesWork_Mes_${format(currentMonth, 'yyyy-MM')}.pdf`
      shareBlob(blob, filename)
    } catch (e) { console.error(e) }
    setPdfLoading(null)
  }

  const totalMonthSeconds = records.reduce((acc, r) => acc + r.effectiveSeconds, 0)
  const monthLabel = format(currentMonth, 'MMMM yyyy', { locale: es }).toUpperCase()

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-black">
      {/* Header */}
      <div className="flex-shrink-0 px-5 pt-6 pb-4" style={{ borderBottom: '1px solid #1A1A24' }}>
        <div className="text-xs tracking-[0.3em] uppercase mb-2" style={{ color: '#4A4A5A' }}>Historial</div>

        {/* Month selector */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}
            className="p-2 rounded-xl transition-all active:scale-90"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #2A2A38' }}
          >
            <ChevronLeft size={20} style={{ color: '#C9A84C' }} />
          </button>

          <div className="text-center">
            <div
              className="text-lg font-bold tracking-wider"
              style={{ fontFamily: 'var(--font-display)', color: '#C9A84C' }}
            >
              {monthLabel}
            </div>
            {!loading && (
              <div className="text-xs mt-0.5" style={{ color: '#4A4A5A' }}>
                {records.length} jornadas · {formatDuration(totalMonthSeconds)} efectivas
              </div>
            )}
          </div>

          <button
            onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
            className="p-2 rounded-xl transition-all active:scale-90"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #2A2A38' }}
          >
            <ChevronRight size={20} style={{ color: '#C9A84C' }} />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="animate-spin" size={28} style={{ color: '#C9A84C' }} />
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <Calendar size={40} style={{ color: '#2A2A38' }} />
            <p className="text-sm" style={{ color: '#4A4A5A' }}>Sin registros este mes</p>
          </div>
        ) : (
          records.map(record => (
            <div
              key={record.sessionId}
              className="rounded-2xl overflow-hidden animate-in"
              style={{ background: '#0D0D14', border: '1px solid #1E1E2E' }}
            >
              {/* Card header */}
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: '1px solid #1A1A24' }}
              >
                <div>
                  <div
                    className="text-xs uppercase tracking-widest font-semibold"
                    style={{ color: '#C9A84C' }}
                  >
                    {format(parseISO(record.date + 'T00:00:00'), 'EEEE', { locale: es })}
                  </div>
                  <div className="text-base font-bold" style={{ color: '#E8E8F0' }}>
                    {format(parseISO(record.date + 'T00:00:00'), 'd MMM yyyy', { locale: es })}
                  </div>
                </div>

                <div className="text-right">
                  <div
                    className="text-2xl font-black"
                    style={{ fontFamily: 'var(--font-mono)', color: '#00E5FF' }}
                  >
                    {formatDuration(record.effectiveSeconds)}
                  </div>
                  <div className="text-xs" style={{ color: '#4A4A5A' }}>Efectivas</div>
                </div>
              </div>

              {/* Card body */}
              <div className="px-4 py-3 grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-xs uppercase tracking-wider mb-1" style={{ color: '#4A4A5A' }}>Entrada</div>
                  <div className="text-sm font-semibold" style={{ color: '#10B981', fontFamily: 'var(--font-mono)' }}>
                    {record.startTime ? formatTime(record.startTime) : '–'}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider mb-1" style={{ color: '#4A4A5A' }}>Pausas</div>
                  <div className="text-sm font-semibold" style={{ color: '#F59E0B', fontFamily: 'var(--font-mono)' }}>
                    {formatDuration(record.pauseSeconds)}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider mb-1" style={{ color: '#4A4A5A' }}>Salida</div>
                  <div className="text-sm font-semibold" style={{ color: '#EF4444', fontFamily: 'var(--font-mono)' }}>
                    {record.endTime ? formatTime(record.endTime) : '–'}
                  </div>
                </div>
              </div>

              {/* PDF button */}
              <div className="px-4 pb-3">
                <button
                  onClick={() => handleDailyPDF(record)}
                  disabled={!record.endTime || pdfLoading === record.sessionId || !profile}
                  className="w-full h-10 rounded-xl text-xs font-bold tracking-widest uppercase flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-40"
                  style={{
                    background: 'rgba(201,168,76,0.08)',
                    border: '1px solid rgba(201,168,76,0.2)',
                    color: '#C9A84C',
                  }}
                >
                  {pdfLoading === record.sessionId
                    ? <Loader2 size={14} className="animate-spin" />
                    : <FileText size={14} />}
                  Compartir PDF Diario
                </button>
              </div>
            </div>
          ))
        )}

        {/* Monthly PDF */}
        {!loading && records.length > 0 && (
          <button
            onClick={handleMonthlyPDF}
            disabled={pdfLoading === 'monthly' || !profile}
            className="w-full h-14 rounded-2xl font-bold text-sm tracking-widest uppercase flex items-center justify-center gap-3 transition-all active:scale-95 mt-2 mb-4 disabled:opacity-40"
            style={{
              background: 'linear-gradient(135deg, rgba(201,168,76,0.15), rgba(201,168,76,0.08))',
              border: '1px solid rgba(201,168,76,0.35)',
              color: '#E8C97A',
            }}
          >
            {pdfLoading === 'monthly'
              ? <Loader2 size={18} className="animate-spin" />
              : <Download size={18} />}
            Generar PDF del Mes Completo
          </button>
        )}

        <div className="h-4" />
      </div>

      <BottomNav />
    </div>
  )
}

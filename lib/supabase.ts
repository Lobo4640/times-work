import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://zvirjbjzumxhzfxgmgoq.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2aXJqYmp6dW14aHpmeGdtZ29xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4Nzc3ODIsImV4cCI6MjA5MDQ1Mzc4Mn0.59F45Ooj1aOJpWq86mxRZlop2rm7fzxWJlgpPjlWHyQ'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true, // Esto es clave para la experiencia tipo App
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})


export type Profile = {
  id: string
  email: string
  full_name: string | null
  dni_nif: string | null
  company_name: string | null
  company_cif: string | null
  weekly_hours: number
  net_salary: number | null
  avatar_url: string | null
  created_at: string
}

export type TimeLog = {
  id: string
  user_id: string
  event_type: 'start' | 'pause' | 'resume' | 'end'
  timestamp: string
  latitude: number | null
  longitude: number | null
  accuracy: number | null
  server_timestamp: string
  session_id: string
  notes: string | null
}

export type DailySession = {
  session_id: string
  date: string
  start_time: string
  end_time: string | null
  total_seconds: number
  pause_seconds: number
  events: TimeLog[]
}

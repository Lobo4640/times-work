import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
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

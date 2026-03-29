'use client'
import { useState, useEffect, useRef } from 'react'
import {
  User, Mail, Lock, Building2, CreditCard, Clock, DollarSign,
  LogOut, Camera, Eye, EyeOff, BookOpen, ExternalLink, ChevronRight, Shield, CheckCircle
} from 'lucide-react'
import BottomNav from '@/components/BottomNav'
import Logo from '@/components/Logo'
import { supabase, Profile } from '@/lib/supabase'

const LEGAL_LINKS = [
  { icon: '⚖️', title: 'Jornada Efectiva de Trabajo', desc: 'Art. 34 ET · Límites y cómputo anual', url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2015-11430' },
  { icon: '⏱️', title: 'Horas Extraordinarias', desc: 'Art. 35 ET · Máximos y compensación', url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2015-11430' },
  { icon: '☕', title: 'Descansos Obligatorios', desc: 'Art. 34.4 ET · Pausas en jornada > 6h', url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2015-11430' },
  { icon: '🌙', title: 'Trabajo Nocturno', desc: 'Art. 36 ET · Derechos y compensación', url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2015-11430' },
]

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<Partial<Profile>>({})
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' | 'info' } | null>(null)
  const [saving, setSaving] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function showToast(msg: string, type: 'ok' | 'err' | 'info') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      if (data.session?.user) loadProfile(data.session.user.id)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user.id)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  async function loadProfile(uid: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single()
    if (data) {
      setProfile(data)
      if (data.avatar_url) setAvatarUrl(data.avatar_url)
    }
  }

  async function handleAuth() {
    if (!email || !password) { showToast('Rellena todos los campos', 'err'); return }
    setLoading(true)
    if (authMode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) showToast(error.message, 'err')
      else showToast('¡Bienvenido!', 'ok')
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) showToast(error.message, 'err')
      else showToast('Cuenta creada. Revisa tu email.', 'ok')
    }
    setLoading(false)
  }

  async function handleForgot() {
    if (!email) { showToast('Introduce tu email', 'err'); return }
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/profile`,
    })
    if (error) showToast(error.message, 'err')
    else showToast('Enlace enviado a tu correo ✓', 'ok')
    setLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setProfile({})
    setAvatarUrl(null)
    showToast('Sesión cerrada', 'info')
  }

  async function saveProfile() {
    if (!user) return
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, ...profile, updated_at: new Date().toISOString() })
    if (error) showToast(error.message, 'err')
    else showToast('Datos guardados ✓', 'ok')
    setSaving(false)
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setLoading(true)
    const ext = file.name.split('.').pop()
    const path = `avatars/${user.id}.${ext}`
    const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (uploadErr) { showToast(uploadErr.message, 'err'); setLoading(false); return }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    const url = data.publicUrl + '?t=' + Date.now()
    setAvatarUrl(url)
    setProfile(p => ({ ...p, avatar_url: url }))
    await supabase.from('profiles').upsert({ id: user.id, avatar_url: url })
    showToast('Foto actualizada ✓', 'ok')
    setLoading(false)
  }

  const fieldClass = "input-field"

  // ── AUTH SCREEN ──
  if (!user) return (
    <div className="flex flex-col flex-1 overflow-hidden bg-black">
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="flex flex-col items-center mb-8">
          <Logo size="lg" showText />
        </div>

        <div className="card-elevated p-6 space-y-5 mb-6">
          <h2
            className="text-xl font-bold text-center"
            style={{ fontFamily: 'var(--font-display)', color: '#C9A84C' }}
          >
            {authMode === 'login' ? 'Iniciar Sesión'
              : authMode === 'register' ? 'Crear Cuenta'
              : 'Recuperar Contraseña'}
          </h2>

          <div className="space-y-3">
            <div className="relative">
              <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: '#4A4A5A' }} />
              <input
                type="email"
                placeholder="correo@ejemplo.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className={fieldClass}
                style={{ paddingLeft: '40px' }}
              />
            </div>

            {authMode !== 'forgot' && (
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: '#4A4A5A' }} />
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="Contraseña"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className={fieldClass}
                  style={{ paddingLeft: '40px', paddingRight: '44px' }}
                  onKeyDown={e => e.key === 'Enter' && handleAuth()}
                />
                <button
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2"
                  style={{ color: '#4A4A5A' }}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            )}
          </div>

          <button
            onClick={authMode === 'forgot' ? handleForgot : handleAuth}
            disabled={loading}
            className="w-full h-13 py-4 rounded-2xl font-bold text-sm tracking-widest uppercase transition-all active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #C9A84C, #8B6914)',
              color: '#000',
            }}
          >
            {loading ? '...' : authMode === 'login' ? 'Entrar' : authMode === 'register' ? 'Crear Cuenta' : 'Enviar Enlace'}
          </button>

          <div className="flex flex-col gap-2 text-center text-sm">
            {authMode === 'login' && (
              <>
                <button onClick={() => setAuthMode('register')} style={{ color: '#C9A84C' }}>
                  ¿Sin cuenta? Regístrate →
                </button>
                <button onClick={() => setAuthMode('forgot')} style={{ color: '#4A4A5A' }}>
                  Olvidé mi contraseña
                </button>
              </>
            )}
            {authMode !== 'login' && (
              <button onClick={() => setAuthMode('login')} style={{ color: '#C9A84C' }}>
                ← Volver al login
              </button>
            )}
          </div>
        </div>

        <div
          className="rounded-2xl p-4 flex items-center gap-3"
          style={{ background: 'rgba(0,229,255,0.05)', border: '1px solid rgba(0,229,255,0.1)' }}
        >
          <Shield size={18} style={{ color: '#00E5FF', flexShrink: 0 }} />
          <p className="text-xs" style={{ color: '#4A8A90', lineHeight: 1.5 }}>
            Tus datos están cifrados y protegidos. El registro es inalterable por diseño (RD 8/2019).
          </p>
        </div>
      </div>
      <BottomNav />
    </div>
  )

  // ── PROFILE SCREEN ──
  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-black">
      <div className="flex-1 overflow-y-auto">
        {/* Avatar section */}
        <div
          className="flex flex-col items-center py-6 px-6"
          style={{ background: 'linear-gradient(180deg, #0A0A12 0%, #000 100%)', borderBottom: '1px solid #1A1A24' }}
        >
          <div className="relative mb-4">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center overflow-hidden"
              style={{ background: '#1A1A24', border: '2px solid rgba(201,168,76,0.3)' }}
            >
              {avatarUrl
                ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                : <User size={32} style={{ color: '#4A4A5A' }} />}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90"
              style={{ background: '#C9A84C' }}
            >
              <Camera size={14} color="#000" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>
          <div className="text-base font-semibold" style={{ color: '#E8E8F0' }}>
            {profile.full_name || user.email}
          </div>
          <div className="text-xs mt-1" style={{ color: '#4A4A5A' }}>{user.email}</div>
        </div>

        <div className="px-4 py-4 space-y-6 pb-8">
          {/* Worker data */}
          <section>
            <div className="text-xs tracking-[0.25em] uppercase mb-3 font-semibold" style={{ color: '#C9A84C' }}>
              Datos del Trabajador
            </div>
            <div className="card space-y-3 p-4">
              <Field icon={<User size={15} />} label="Nombre Completo">
                <input
                  className={fieldClass}
                  placeholder="Juan García López"
                  value={profile.full_name ?? ''}
                  onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))}
                />
              </Field>
              <Field icon={<CreditCard size={15} />} label="DNI / NIF">
                <input
                  className={fieldClass}
                  placeholder="12345678A"
                  value={profile.dni_nif ?? ''}
                  onChange={e => setProfile(p => ({ ...p, dni_nif: e.target.value }))}
                />
              </Field>
            </div>
          </section>

          {/* Company data */}
          <section>
            <div className="text-xs tracking-[0.25em] uppercase mb-3 font-semibold" style={{ color: '#C9A84C' }}>
              Datos de Empresa (para PDF)
            </div>
            <div className="card space-y-3 p-4">
              <Field icon={<Building2 size={15} />} label="Nombre de Empresa">
                <input
                  className={fieldClass}
                  placeholder="Empresa S.L."
                  value={profile.company_name ?? ''}
                  onChange={e => setProfile(p => ({ ...p, company_name: e.target.value }))}
                />
              </Field>
              <Field icon={<CreditCard size={15} />} label="CIF de Empresa">
                <input
                  className={fieldClass}
                  placeholder="B12345678"
                  value={profile.company_cif ?? ''}
                  onChange={e => setProfile(p => ({ ...p, company_cif: e.target.value }))}
                />
              </Field>
            </div>
          </section>

          {/* Work config */}
          <section>
            <div className="text-xs tracking-[0.25em] uppercase mb-3 font-semibold" style={{ color: '#C9A84C' }}>
              Configuración Laboral
            </div>
            <div className="card space-y-3 p-4">
              <Field icon={<Clock size={15} />} label="Jornada Semanal Base (horas)">
                <input
                  type="number"
                  className={fieldClass}
                  placeholder="40"
                  value={profile.weekly_hours ?? ''}
                  onChange={e => setProfile(p => ({ ...p, weekly_hours: Number(e.target.value) }))}
                />
              </Field>
              <Field icon={<DollarSign size={15} />} label="Sueldo Neto Mensual (€)">
                <input
                  type="number"
                  className={fieldClass}
                  placeholder="1.500"
                  value={profile.net_salary ?? ''}
                  onChange={e => setProfile(p => ({ ...p, net_salary: Number(e.target.value) }))}
                />
              </Field>
            </div>
          </section>

          {/* Save */}
          <button
            onClick={saveProfile}
            disabled={saving}
            className="w-full h-14 rounded-2xl font-bold text-sm tracking-widest uppercase transition-all active:scale-95"
            style={{ background: 'linear-gradient(135deg, #C9A84C, #8B6914)', color: '#000' }}
          >
            {saving ? '...' : '✓  Guardar Datos'}
          </button>

          {/* Legal section */}
          <section>
            <div className="text-xs tracking-[0.25em] uppercase mb-3 font-semibold flex items-center gap-2" style={{ color: '#C9A84C' }}>
              <BookOpen size={13} /> Saber es Poder
            </div>
            <div className="card divide-y" style={{ borderColor: '#1E1E2E' }}>
              {LEGAL_LINKS.map((link, i) => (
                <a
                  key={i}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-3 transition-all active:opacity-70"
                >
                  <span className="text-lg">{link.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium" style={{ color: '#E8E8F0' }}>{link.title}</div>
                    <div className="text-xs" style={{ color: '#4A4A5A' }}>{link.desc}</div>
                  </div>
                  <ExternalLink size={14} style={{ color: '#4A4A5A', flexShrink: 0 }} />
                </a>
              ))}
            </div>
          </section>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="w-full h-12 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-95"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444' }}
          >
            <LogOut size={16} />
            Cerrar Sesión
          </button>

          <div className="h-2" />
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="absolute left-4 right-4 rounded-2xl px-4 py-3 flex items-center gap-2 text-sm font-medium animate-in"
          style={{
            bottom: '90px',
            zIndex: 50,
            background: toast.type === 'ok' ? 'rgba(16,185,129,0.15)' : toast.type === 'err' ? 'rgba(239,68,68,0.15)' : 'rgba(0,229,255,0.1)',
            border: `1px solid ${toast.type === 'ok' ? 'rgba(16,185,129,0.4)' : toast.type === 'err' ? 'rgba(239,68,68,0.4)' : 'rgba(0,229,255,0.3)'}`,
            color: toast.type === 'ok' ? '#10B981' : toast.type === 'err' ? '#EF4444' : '#00E5FF',
            backdropFilter: 'blur(12px)',
          }}
        >
          <CheckCircle size={16} />
          {toast.msg}
        </div>
      )}

      <BottomNav />
    </div>
  )
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#6B6B8A' }}>
        <span style={{ color: '#4A4A5A' }}>{icon}</span>
        {label}
      </label>
      {children}
    </div>
  )
}

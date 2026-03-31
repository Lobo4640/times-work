'use client'
import { useState, useEffect, useRef } from 'react'
import {
  User, Mail, Lock, Building2, CreditCard, Clock, DollarSign,
  LogOut, Camera, Eye, EyeOff, BookOpen, ExternalLink, Shield, CheckCircle, AlertCircle, Loader2
} from 'lucide-react'
import BottomNav from '@/components/BottomNav'
import Logo from '@/components/Logo'
import { supabase, type Profile } from '@/lib/supabase'

export const dynamic = 'force-dynamic';

const LEGAL_LINKS = [
  { icon: '⚖️', title: 'Jornada Efectiva de Trabajo', desc: 'Art. 34 ET · Límites y cómputo anual', url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2015-11430' },
  { icon: '⏱️', title: 'Horas Extraordinarias', desc: 'Art. 35 ET · Máximos y compensación', url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2015-11430' },
  { icon: '☕', title: 'Descansos Obligatorios', desc: 'Art. 34.4 ET · Pausas en jornada > 6h', url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2015-11430' },
  { icon: '🌙', title: 'Trabajo Nocturno', desc: 'Art. 36 ET · Derechos y compensación', url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2015-11430' },
]

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<Partial<Profile>>({
    full_name: '',
    dni_nif: '',
    company_name: '',
    company_cif: '',
    weekly_hours: 40,
    net_salary: 0
  })
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' | 'info' } | null>(null)
  const [saving, setSaving] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function showToast(msg: string, type: 'ok' | 'err' | 'info') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  useEffect(() => {
    // 1. Obtener sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user)
        loadProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // 2. Escuchar cambios de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile(session.user.id)
      } else {
        setLoading(false)
        setProfile({})
        setAvatarUrl(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(uid: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .single()

      if (error && error.code !== 'PGRST116') throw error // PGRST116 es "no rows found", normal si es nuevo
      
      if (data) {
        setProfile(data)
        if (data.avatar_url) setAvatarUrl(data.avatar_url)
      }
    } catch (err: any) {
      console.error('Error cargando perfil:', err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleAuth() {
    if (!email || !password) { showToast('Rellena todos los campos', 'err'); return }
    setSaving(true)
    
    const { error } = authMode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })

    if (error) {
      showToast(error.message, 'err')
    } else {
      if (authMode === 'register') showToast('Cuenta creada. Revisa tu email.', 'ok')
      else showToast('¡Bienvenido de nuevo!', 'ok')
    }
    setSaving(false)
  }

  async function handleForgot() {
    if (!email) { showToast('Introduce tu email', 'err'); return }
    setSaving(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/profile`,
    })
    if (error) showToast(error.message, 'err')
    else showToast('Enlace enviado a tu correo ✓', 'ok')
    setSaving(false)
  }

  async function saveProfile() {
    if (!user) return
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .upsert({ 
        id: user.id, 
        ...profile, 
        updated_at: new Date().toISOString() 
      })

    if (error) showToast(error.message, 'err')
    else showToast('Perfil actualizado correctamente ✓', 'ok')
    setSaving(false)
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    
    setSaving(true)
    const ext = file.name.split('.').pop()
    const filePath = `${user.id}/${Math.random()}.${ext}`

    // Subir imagen
    const { error: uploadErr } = await supabase.storage
      .from('avatars')
      .upload(filePath, file)

    if (uploadErr) {
      showToast(uploadErr.message, 'err')
      setSaving(false)
      return
    }

    // Obtener URL pública
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath)

    setAvatarUrl(publicUrl)
    setProfile(p => ({ ...p, avatar_url: publicUrl }))
    
    // Guardar URL en el perfil
    await supabase.from('profiles').upsert({ id: user.id, avatar_url: publicUrl })
    
    showToast('Foto de perfil actualizada ✓', 'ok')
    setSaving(false)
  }

  // --- RENDERS ---

  if (loading) return (
    <div className="h-screen bg-black flex flex-col items-center justify-center gap-4">
      <Loader2 className="w-10 h-10 text-gold animate-spin" />
      <p className="text-gold font-mono text-[10px] tracking-[0.3em]">CARGANDO_PERFIL...</p>
    </div>
  )

  if (!user) return (
    <div className="flex flex-col h-screen bg-black overflow-hidden">
      <div className="flex-1 overflow-y-auto px-6 py-12 flex flex-col items-center">
        <Logo size="lg" showText />
        
        <div className="w-full max-w-sm mt-10 card-elevated p-8 space-y-6">
          <h2 className="text-2xl font-bold text-center text-gold font-display">
            {authMode === 'login' ? 'Bienvenido' : authMode === 'register' ? 'Nueva Cuenta' : 'Recuperar'}
          </h2>

          <div className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
              <input
                type="email" placeholder="Correo electrónico"
                className="input-field pl-12"
                value={email} onChange={e => setEmail(e.target.value)}
              />
            </div>

            {authMode !== 'forgot' && (
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                <input
                  type={showPass ? 'text' : 'password'} placeholder="Contraseña"
                  className="input-field pl-12 pr-12"
                  value={password} onChange={e => setPassword(e.target.value)}
                />
                <button onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20">
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            )}
          </div>

          <button
            onClick={authMode === 'forgot' ? handleForgot : handleAuth}
            disabled={saving}
            className="w-full h-14 rounded-2xl bg-gradient-to-br from-gold to-gold-dark text-black font-bold uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center"
          >
            {saving ? <Loader2 className="animate-spin" /> : authMode === 'login' ? 'Entrar' : 'Registrarse'}
          </button>

          <div className="flex flex-col gap-3 text-center text-sm">
            {authMode === 'login' ? (
              <>
                <button onClick={() => setAuthMode('register')} className="text-gold font-medium">Crear una cuenta nueva →</button>
                <button onClick={() => setAuthMode('forgot')} className="text-white/30 text-xs italic">He olvidado mi contraseña</button>
              </>
            ) : (
              <button onClick={() => setAuthMode('login')} className="text-gold font-medium">← Volver al inicio de sesión</button>
            )}
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  )

  return (
    <div className="flex flex-col h-screen bg-black overflow-hidden">
      <div className="flex-1 overflow-y-auto pb-32">
        {/* Cabecera / Avatar */}
        <div className="relative px-6 pt-12 pb-8 flex flex-col items-center bg-gradient-to-b from-gold/10 to-transparent">
          <div className="relative group">
            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-gold/30 bg-surface-card flex items-center justify-center">
              {avatarUrl ? (
                <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <User size={40} className="text-white/10" />
              )}
            </div>
            <button 
              onClick={() => fileRef.current?.click()}
              className="absolute bottom-0 right-0 w-8 h-8 bg-gold rounded-full flex items-center justify-center text-black shadow-lg active:scale-90 transition-transform"
            >
              <Camera size={16} />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>
          <h1 className="mt-4 text-xl font-bold text-white tracking-tight">{profile.full_name || 'Nuevo Usuario'}</h1>
          <p className="text-white/40 text-xs font-mono">{user.email}</p>
        </div>

        {/* Formulario */}
        <div className="px-6 space-y-8">
          
          <section className="space-y-4">
            <h3 className="text-[10px] font-bold text-gold tracking-[0.3em] uppercase opacity-50">Identificación Laboral</h3>
            <div className="card-elevated p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-white/40 flex items-center gap-2"><User size={12}/> Nombre Completo</label>
                <input 
                  className="input-field" value={profile.full_name || ''} 
                  onChange={e => setProfile({...profile, full_name: e.target.value})}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-white/40 flex items-center gap-2"><CreditCard size={12}/> DNI / NIF</label>
                <input 
                  className="input-field" value={profile.dni_nif || ''} 
                  onChange={e => setProfile({...profile, dni_nif: e.target.value})}
                />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-[10px] font-bold text-gold tracking-[0.3em] uppercase opacity-50">Empresa Activa</h3>
            <div className="card-elevated p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-white/40 flex items-center gap-2"><Building2 size={12}/> Razón Social</label>
                <input 
                  className="input-field" value={profile.company_name || ''} 
                  onChange={e => setProfile({...profile, company_name: e.target.value})}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-white/40 flex items-center gap-2"><CreditCard size={12}/> CIF Empresa</label>
                <input 
                  className="input-field" value={profile.company_cif || ''} 
                  onChange={e => setProfile({...profile, company_cif: e.target.value})}
                />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-[10px] font-bold text-gold tracking-[0.3em] uppercase opacity-50">Condiciones de Contrato</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="card-elevated p-4 space-y-2">
                <label className="text-[10px] text-white/40 uppercase">Horas/Semana</label>
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-gold" />
                  <input 
                    type="number" className="bg-transparent w-full font-bold outline-none" 
                    value={profile.weekly_hours || ''} 
                    onChange={e => setProfile({...profile, weekly_hours: Number(e.target.value)})}
                  />
                </div>
              </div>
              <div className="card-elevated p-4 space-y-2">
                <label className="text-[10px] text-white/40 uppercase">Sueldo Neto (€)</label>
                <div className="flex items-center gap-2">
                  <DollarSign size={16} className="text-gold" />
                  <input 
                    type="number" className="bg-transparent w-full font-bold outline-none" 
                    value={profile.net_salary || ''} 
                    onChange={e => setProfile({...profile, net_salary: Number(e.target.value)})}
                  />
                </div>
              </div>
            </div>
          </section>

          <button 
            onClick={saveProfile} disabled={saving}
            className="w-full h-16 rounded-2xl bg-white text-black font-bold uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95 transition-all shadow-xl"
          >
            {saving ? <Loader2 className="animate-spin"/> : <><CheckCircle size={20}/> Guardar cambios</>}
          </button>

          <section className="space-y-4">
             <h3 className="text-[10px] font-bold text-gold tracking-[0.3em] uppercase opacity-50">Base Legal RD 8/2019</h3>
             <div className="space-y-2">
                {LEGAL_LINKS.map((link, idx) => (
                  <a key={idx} href={link.url} target="_blank" className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 active:bg-white/10">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{link.icon}</span>
                      <div>
                        <p className="text-sm font-medium text-white/80">{link.title}</p>
                        <p className="text-[10px] text-white/30">{link.desc}</p>
                      </div>
                    </div>
                    <ExternalLink size={14} className="text-white/20"/>
                  </a>
                ))}
             </div>
          </section>

          <button 
            onClick={() => supabase.auth.signOut()}
            className="w-full py-4 text-red-500/60 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2"
          >
            <LogOut size={14}/> Cerrar sesión
          </button>
        </div>
      </div>

      {/* Toast System */}
      {toast && (
        <div className={`fixed bottom-24 left-6 right-6 p-4 rounded-2xl backdrop-blur-xl border flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 z-50 ${
          toast.type === 'ok' ? 'bg-green-500/10 border-green-500/20 text-green-500' : 
          toast.type === 'err' ? 'bg-red-500/10 border-red-500/20 text-red-500' : 
          'bg-cyan-500/10 border-cyan-500/20 text-cyan-500'
        }`}>
          {toast.type === 'ok' ? <CheckCircle size={18}/> : <AlertCircle size={18}/>}
          <p className="text-sm font-medium">{toast.msg}</p>
        </div>
      )}

      <BottomNav />
    </div>
  )
}

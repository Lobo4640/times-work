-- ============================================================
--  TIMES WORK · Esquema Supabase SQL
--  Registro de Jornada Inalterable · RD 8/2019
-- ============================================================

-- Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLA: profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT,
  full_name       TEXT,
  dni_nif         TEXT,
  company_name    TEXT,
  company_cif     TEXT,
  weekly_hours    NUMERIC(5,2) NOT NULL DEFAULT 40,
  net_salary      NUMERIC(10,2),
  avatar_url      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice
CREATE INDEX IF NOT EXISTS profiles_id_idx ON public.profiles(id);

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Crear perfil automáticamente al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- TABLA: time_logs  (INALTERABLE - Solo INSERT, nunca UPDATE/DELETE)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.time_logs (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id       TEXT NOT NULL,
  event_type       TEXT NOT NULL CHECK (event_type IN ('start', 'pause', 'resume', 'end')),

  -- Timestamps duales: cliente + servidor (prueba de inalterabilidad)
  timestamp        TIMESTAMPTZ NOT NULL,              -- Hora local del dispositivo
  server_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(), -- Hora del servidor (inalterable)

  -- Geolocalización
  latitude         DOUBLE PRECISION,
  longitude        DOUBLE PRECISION,
  accuracy         DOUBLE PRECISION,  -- en metros

  -- Metadatos adicionales
  notes            TEXT,
  device_info      TEXT,  -- user-agent (opcional, para auditoría)

  -- Audit fields (inmutables)
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()

  -- NOTA: Sin updated_at intencionalmente.
  -- Los registros son de SOLO ESCRITURA para el usuario.
);

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS time_logs_user_id_idx ON public.time_logs(user_id);
CREATE INDEX IF NOT EXISTS time_logs_session_id_idx ON public.time_logs(session_id);
CREATE INDEX IF NOT EXISTS time_logs_timestamp_idx ON public.time_logs(timestamp);
CREATE INDEX IF NOT EXISTS time_logs_user_timestamp_idx ON public.time_logs(user_id, timestamp DESC);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_logs ENABLE ROW LEVEL SECURITY;

-- ── Políticas para PROFILES ──

-- SELECT: cada usuario ve solo su propio perfil
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- INSERT: solo el propio usuario puede insertar su perfil
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- UPDATE: solo el propio usuario puede actualizar su perfil
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- DELETE: prohibido por política (sin política DELETE = nadie puede borrar)
-- No creamos política DELETE → acceso denegado por defecto.

-- ── Políticas para TIME_LOGS ──

-- SELECT: cada usuario ve solo sus propios registros
CREATE POLICY "time_logs_select_own"
  ON public.time_logs FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: el usuario puede crear registros propios
CREATE POLICY "time_logs_insert_own"
  ON public.time_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ¡¡ CRÍTICO PARA BLINDAJE LEGAL !!
-- UPDATE: COMPLETAMENTE PROHIBIDO para todos (incluido el propio usuario)
-- Sin política UPDATE → acceso denegado por defecto en RLS.
-- Esto garantiza la INALTERABILIDAD del registro ante Inspección de Trabajo.

-- DELETE: COMPLETAMENTE PROHIBIDO para todos
-- Sin política DELETE → acceso denegado por defecto en RLS.

-- ============================================================
-- FUNCIÓN: obtener resumen diario (helper para la app)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_daily_summary(
  p_user_id UUID,
  p_date DATE
)
RETURNS TABLE (
  session_id   TEXT,
  start_time   TIMESTAMPTZ,
  end_time     TIMESTAMPTZ,
  event_count  BIGINT
)
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT
    tl.session_id,
    MIN(CASE WHEN tl.event_type = 'start' THEN tl.timestamp END) as start_time,
    MAX(CASE WHEN tl.event_type = 'end'   THEN tl.timestamp END) as end_time,
    COUNT(*) as event_count
  FROM public.time_logs tl
  WHERE
    tl.user_id = p_user_id
    AND tl.timestamp::DATE = p_date
  GROUP BY tl.session_id
  ORDER BY start_time ASC;
$$;

-- ============================================================
-- FUNCIÓN: resumen mensual con horas efectivas
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_monthly_summary(
  p_user_id UUID,
  p_year    INT,
  p_month   INT
)
RETURNS TABLE (
  date              DATE,
  session_id        TEXT,
  start_time        TIMESTAMPTZ,
  end_time          TIMESTAMPTZ,
  total_minutes     NUMERIC,
  event_count       BIGINT
)
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT
    tl.timestamp::DATE as date,
    tl.session_id,
    MIN(CASE WHEN tl.event_type = 'start' THEN tl.timestamp END) as start_time,
    MAX(CASE WHEN tl.event_type = 'end'   THEN tl.timestamp END) as end_time,
    EXTRACT(EPOCH FROM (
      MAX(CASE WHEN tl.event_type = 'end' THEN tl.timestamp END) -
      MIN(CASE WHEN tl.event_type = 'start' THEN tl.timestamp END)
    )) / 60 as total_minutes,
    COUNT(*) as event_count
  FROM public.time_logs tl
  WHERE
    tl.user_id = p_user_id
    AND EXTRACT(YEAR  FROM tl.timestamp) = p_year
    AND EXTRACT(MONTH FROM tl.timestamp) = p_month
  GROUP BY tl.timestamp::DATE, tl.session_id
  ORDER BY date ASC;
$$;

-- ============================================================
-- STORAGE: bucket para avatares
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,  -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Política Storage: solo el usuario puede subir/ver su propio avatar
CREATE POLICY "avatar_upload_own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "avatar_update_own"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "avatar_select_all"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- ============================================================
-- VERIFICACIÓN FINAL: mostrar tablas creadas
-- ============================================================
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'time_logs');

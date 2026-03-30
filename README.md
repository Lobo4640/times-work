# ⏱️ Times Work · Tiempo de Trabajo

**PWA de registro de jornada laboral inalterable con blindaje legal.**

> GPS + Timestamp servidor + RLS Supabase + PDF con firma legal · RD 8/2019

---

## 🛠️ Stack Técnico

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 14 (App Router) + TypeScript |
| Estilos | Tailwind CSS + CSS Variables |
| Backend | Supabase (Auth + DB + Storage + RLS) |
| PDF | jsPDF + jsPDF-AutoTable |
| PWA | next-pwa + Service Worker custom |
| Despliegue | Vercel (recomendado) |

---

## 🚀 Instalación

### 1. Clonar y configurar

```bash
git clone <repo>
cd times-work
npm install
```

### 2. Variables de entorno

```bash
cp .env.local.example .env.local
```

Rellena con tus credenciales de Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=https://TU_PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
```

### 3. Configurar Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com)
2. Ve a **SQL Editor** y ejecuta el contenido de `supabase/schema.sql`
3. En **Storage** → verifica que el bucket `avatars` está creado como **público**
4. En **Authentication** → activa **Email/Password** en providers

### 4. Logo / Icono de la App

Coloca el logo del conejo en `/public/` con estos nombres:
```
public/
├── icon.png           → 512×512 (logo principal)
├── icon-512.png       → 512×512
├── icon-192.png       → 192×192
├── icon-128.png       → 128×128
├── icon-96.png        → 96×96
├── icon-72.png        → 72×72
└── apple-touch-icon.png → 180×180
```

> 💡 Puedes generar todos los tamaños desde `icon.png` con: [realfavicongenerator.net](https://realfavicongenerator.net)

### 5. Arrancar en desarrollo

```bash
npm run dev
```

### 6. Build de producción

```bash
npm run build
npm start
```

---

## 🏗️ Estructura del Proyecto

```
times-work/
├── app/
│   ├── layout.tsx          # Root layout (PWA meta tags)
│   ├── page.tsx            # Redirect a /clock
│   ├── globals.css         # Estilos globales + tema oscuro
│   ├── clock/
│   │   └── page.tsx        # 🕐 Pantalla principal del reloj
│   ├── history/
│   │   └── page.tsx        # 📋 Historial + exportación PDF
│   └── profile/
│       └── page.tsx        # 👤 Perfil, auth, ajustes
├── components/
│   ├── BottomNav.tsx       # Barra de navegación inferior iOS
│   ├── Logo.tsx            # Componente del logotipo
│   ├── Toast.tsx           # Notificaciones in-app
│   └── LoadingSpinner.tsx  # Spinner de carga
├── hooks/
│   ├── useAuth.ts          # Hook de autenticación
│   ├── useClock.ts         # Hook del cronómetro (estado + GPS + Supabase)
│   └── useNotifications.ts # Hook de notificaciones push
├── lib/
│   ├── supabase.ts         # Cliente Supabase + tipos
│   ├── pdfGenerator.ts     # Generación PDF diario y mensual
│   └── timeUtils.ts        # Utilidades de tiempo + persistencia localStorage
├── public/
│   ├── sw.js               # Service Worker (caché + notificaciones)
│   ├── manifest.json       # PWA manifest
│   └── icon.png            # ← Pon aquí el logo del conejo
└── supabase/
    └── schema.sql          # Esquema completo de la base de datos
```

---

## ⚖️ Blindaje Legal

### ¿Por qué es inalterable?

La arquitectura garantiza la inalterabilidad del registro:

1. **RLS estricto**: Las políticas `UPDATE` y `DELETE` en `time_logs` están completamente bloqueadas. El usuario solo puede `INSERT` y `SELECT`.

2. **Timestamp doble**: Cada evento registra:
   - `timestamp` → hora del dispositivo del usuario
   - `server_timestamp` → hora del servidor Supabase (`DEFAULT now()`)

3. **PDF firmado**: El PDF generado incluye el ID de sesión, ambos timestamps, coordenadas GPS y la precisión del fix.

4. **Cumplimiento RD 8/2019**: El Real Decreto de registro de jornada exige que el sistema sea objetivo, fiable e inaccesible para modificación por el trabajador o empresa.

---

## 📱 Instalar como PWA

### iOS (iPhone/iPad)
1. Abre la app en Safari
2. Pulsa **Compartir** → **Añadir a pantalla de inicio**

### Android
1. Abre en Chrome
2. Pulsa el banner **"Instalar"** o menú → **"Añadir a pantalla de inicio"**

---

## 🔔 Notificaciones automáticas

El Service Worker programa alertas automáticas:

| Tiempo de jornada | Notificación |
|---|---|
| 3h 45min | ⏰ Aviso: 15min para las 4 horas (derecho a descanso) |
| 7h 45min | ⏰ Aviso: 15min para las 8 horas (jornada máxima) |

---

## 📄 Exportación PDF

- **PDF Diario**: Incluye todos los eventos con GPS, timestamps duales e ID de sesión
- **PDF Mensual**: Resumen con totales, medias y tabla detallada por día
- **Compartir**: Usa la Web Share API → menú nativo del móvil (WhatsApp, Email, Drive…)

---

## 🚀 Despliegue en Vercel

```bash
npm i -g vercel
vercel --prod
```

Añade las variables de entorno en el dashboard de Vercel.

---

## 📝 Licencia

MIT · Times Work · 2024

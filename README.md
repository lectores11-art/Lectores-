# Lectores - Plataforma de Comunidades de Lectura

Plataforma web multi-comunidad privada para clubes de lectura. Inspirada en Skool, con foro, classroom, biblioteca con lector de libros, sala de reuniones en vivo, calendario y suscripciones.

## Stack

- **Frontend/Backend:** Next.js 16 + React 19 + TypeScript + Tailwind CSS
- **Base de datos/Auth/Storage/Realtime:** Supabase
- **Video en vivo:** LiveKit Cloud
- **Pagos:** Stripe Billing
- **Hosting:** Vercel

## Setup

### 1. Clonar e instalar

```bash
npm install
cp .env.local.example .env.local
```

### 2. Configurar Supabase

1. Crear proyecto en [supabase.com](https://supabase.com)
2. Ejecutar migración: `supabase/migrations/001_initial_schema.sql`
3. Crear bucket de storage `books` (privado)
4. Copiar URL y keys a `.env.local`

### 3. Configurar servicios opcionales

- **LiveKit:** [livekit.io](https://livekit.io) → API Key + Secret + URL
- **Stripe:** Dashboard → keys + webhook en `/api/webhooks/stripe`

### 4. Desarrollo

```bash
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000)

### 5. Deploy Vercel

```bash
npx vercel
```

Configurar variables de entorno en Vercel dashboard.

## Estructura

```
src/
  app/
    c/[slug]/          # Comunidad (foro, library, meeting, etc.)
    platform/admin/    # Super admin (crear comunidades)
    join/[token]/      # Flujo de invitación
  components/          # UI por sección
  lib/                 # Supabase, auth, PDF, utils
supabase/migrations/   # Schema + RLS
```

## Flujo de uso

1. **Super admin** crea comunidad en `/platform/admin`
2. Comparte link de invitación `/join/[token]`
3. **Lectoras** se registran y entran a la comunidad
4. **Dueña** gestiona contenido desde panel admin de la comunidad

## Secciones

| Sección | Ruta | Descripción |
|---------|------|-------------|
| Foro | `/c/[slug]/forum` | Hilos, comentarios, likes, fijar |
| Biblioteca | `/c/[slug]/library` | PDFs + lector 2 páginas + progreso |
| Sala | `/c/[slug]/meeting` | Video LiveKit + chat + lector |
| Classroom | `/c/[slug]/classroom` | Cursos con video embed |
| Calendario | `/c/[slug]/calendar` | Eventos del mes |
| Cuenta | `/c/[slug]/settings` | Perfil, contraseña, suscripción |

## Colores

- Base: blanco + slate
- Acento: sky-500 (#0ea5e9) en detalles únicamente

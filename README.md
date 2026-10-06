# yt-str-nek

Panel de moderadores para gestionar la cola de peticiones de música de un stream, sin depender del chat del canal. Interfaz con estética sakura (tema claro y oscuro) y sincronización entre varios moderadores.

## Funcionalidades

- Búsqueda de vídeos en YouTube con miniaturas, canal y duración
- Alta de canciones pegando directamente el enlace (`watch?v=`, `youtu.be/`, `/shorts/`, `/embed/`)
- Nombre del solicitante opcional en cada canción
- Cola con máximo **20** canciones
- Reordenar la cola arrastrando (drag & drop) o con teclado
- Marcar como reproducida, lo que mueve la canción al historial
- Reañadir canciones desde el historial
- Sincronización entre pestañas (sondeo cada 5 s + al recuperar el foco)
- Acceso restringido por usuario y contraseña (sesión con cookie `httpOnly` firmada)

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui · Prisma · PostgreSQL (Vercel Postgres) · jose (JWT) · bcryptjs · dnd-kit · next-themes

## Puesta en marcha

### 1. Dependencias y variables de entorno

```bash
npm install
cp .env.example .env
```

Completa `.env` con tus valores (ver más abajo la tabla de variables).

### 2. Base de datos

```bash
npx prisma migrate deploy   # aplica migraciones
npm run db:seed             # crea el primer usuario si defines SEED_USERNAME/SEED_PASSWORD
```

Para desarrollo local puedes levantar Postgres con Docker:

```bash
docker run -d --name ytstrnek-pg \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -e POSTGRES_DB=ytstrnek \
  -p 5432:5432 postgres:16-alpine
```

### 3. Desarrollo

```bash
npm run dev
```

Abre `http://localhost:3000` e inicia sesión con el usuario creado en el seed.

## Variables de entorno

| Variable | Descripción |
| --- | --- |
| `POSTGRES_PRISMA_URL` | URL de conexión (pooled) a PostgreSQL |
| `POSTGRES_URL_NON_POOLING` | URL de conexión directa, usada por Prisma Migrate |
| `AUTH_SECRET` | Clave para firmar la sesión. Genera con `openssl rand -base64 32` |
| `YOUTUBE_API_KEY` | Clave de la YouTube Data API v3 (necesaria para buscar y resolver vídeos) |
| `SEED_USERNAME` | Usuario inicial que crea `npm run db:seed` |
| `SEED_PASSWORD` | Contraseña del usuario inicial |

### Obtener la YOUTUBE_API_KEY

1. Ve a [Google Cloud Console](https://console.cloud.google.com/) y crea un proyecto.
2. En **APIs y servicios → Biblioteca**, busca *YouTube Data API v3* y actívala.
3. En **APIs y servicios → Credenciales → Crear credenciales → Clave de API**.
4. Opcionalmente restringe la clave por sitio (referencias HTTP) a `*.vercel.app` y `localhost`.
5. Copia la clave a `.env` como `YOUTUBE_API_KEY`.

Sin esta clave, añadir canciones por enlace y la búsqueda devolverán un error indicando que falta configurarla.

## Despliegue en Vercel

1. Sube el repositorio a GitHub.
2. En Vercel, importa el repositorio.
3. Crea una base de datos **Storage → Postgres** y conecta el proyecto.
4. Añade las variables de entorno en **Settings → Environment Variables**.
5. Vercel ejecuta `npm install` (que dispara `prisma generate`) y `npm run build`.

Aplica las migraciones en producción con:

```bash
npx prisma migrate deploy
```

Para crear el primer usuario en producción, define `SEED_USERNAME` y `SEED_PASSWORD` en Vercel y ejecuta `npm run db:seed` de forma local apuntando a la misma base de datos.

## Comandos

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run lint` | ESLint |
| `npx prisma studio` | Interfaz visual de la base de datos |
| `npm run db:seed` | Crea el usuario inicial |
| `npm run db:seed -- --force` | Crea el usuario o actualiza su contraseña |
| `npm run prisma:migrate` | Crea una migración en desarrollo |
| `bash scripts/prod-bootstrap.sh <url> [usuario]` | Aplica migraciones y crea/actualiza un mod contra otra base |

### Preparar la base de producción

Para desplegar en Vercel, las migraciones no se aplican solas en el build. Usa el script, que pide la contraseña de forma oculta y no guarda la URL en disco:

```bash
bash scripts/prod-bootstrap.sh "postgresql://...tu-url..." nek
```

Pide la contraseña del mod por terminal. Si el usuario ya existe, actualiza su contraseña.
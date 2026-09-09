# Guia de Despliegue - Dromedario Pedidos MVP

Esta guia cubre el despliegue en Vercel y en Netlify. Elige una sola plataforma para produccion (no ambas a la vez, para evitar tener dos URLs activas con datos duplicados).

## Recomendacion

**Vercel** es la opcion recomendada para este proyecto porque:
- Next.js (App Router, Server Actions, rutas `app/api`) es soporte nativo de Vercel, sin plugins ni capas de compatibilidad.
- Este proyecto usa Next.js 16, una version muy reciente; Vercel la soporta el mismo dia de lanzamiento.
- Cero configuracion: Vercel detecta el framework automaticamente.

**Netlify** es una alternativa valida si el cliente ya centraliza su infraestructura ahi (por ejemplo, si otros proyectos del equipo viven en Netlify). Requiere el plugin `@netlify/plugin-nextjs` (ya configurado en `netlify.toml` en este repo) y puede ir uno o dos pasos atras en soporte de versiones nuevas de Next.js.

---

## 0. Prerrequisitos (aplican a ambas plataformas)

### 0.1 Repositorio en GitHub

Este repo todavia no tiene un remoto configurado. Antes de conectar cualquier plataforma:

```bash
git remote add origin https://github.com/<org>/<repo>.git
git push -u origin main
```

Tanto Vercel como Netlify se conectan directo a GitHub para hacer deploy automatico en cada push.

### 0.2 Variables de entorno necesarias

| Variable | Donde se usa | Notas |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Build/runtime | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Build/runtime | Anon/public key |

**Nunca** agregues `SUPABASE_SERVICE_ROLE_KEY` en Vercel, Netlify ni ningun entorno expuesto al navegador. Esa key vive unicamente como secreto de la Supabase Edge Function `admin-create-user`.

### 0.3 Preparacion de Supabase (una sola vez, independiente de la plataforma de hosting)

1. Ejecutar `supabase/schema.sql` en el SQL Editor del proyecto Supabase.
2. En Project Settings > API > Exposed schemas, agregar `dromedario`.
3. Deploy de la Edge Function:
   ```bash
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   supabase functions deploy admin-create-user
   ```
4. Crear el primer admin (ver seccion "Create users" del README) despues de que exista al menos un usuario en Supabase Auth.

---

## 1. Despliegue en Vercel

1. Entrar a https://vercel.com/new e importar el repositorio de GitHub.
2. Vercel detecta Next.js automaticamente. Dejar el comando de build por defecto (`next build`) y el Root Directory apuntando a la raiz del repo (donde esta este `package.json`).
3. En "Environment Variables" agregar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Production, Preview y Development).
4. Deploy.
5. (Opcional) Configurar dominio propio en Settings > Domains.

No se requiere ningun archivo de configuracion adicional (`vercel.json`) para este proyecto.

---

## 2. Despliegue en Netlify

Este repo ya incluye `netlify.toml` con el build command y el plugin de Next.js configurados:

```toml
[build]
  command = "npm run build"

[[plugins]]
  package = "@netlify/plugin-nextjs"

[build.environment]
  NODE_VERSION = "20"
```

Pasos:

1. Entrar a https://app.netlify.com/start e importar el repositorio de GitHub.
2. Netlify debe detectar el `netlify.toml` automaticamente; si pide un "Publish directory" manual, dejarlo vacio (lo maneja el plugin).
3. En Site settings > Environment variables agregar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Deploy.
5. (Opcional) Configurar dominio propio en Site settings > Domain management.

Si el build falla por incompatibilidad de version de Next.js con el runtime de Netlify, revisar la version instalada del plugin (`@netlify/plugin-nextjs`) y actualizarla al ultimo release antes de reintentar.

---

## 3. Subir cambios al repo del cliente

El repo (`enterdevsas/dromedario_pedidos`) es propiedad de la cuenta de GitHub del cliente, no de una cuenta personal. Vercel (plan Hobby) bloquea el deploy si el autor de un commit no tiene acceso directo al repo, asi que los commits deben quedar a nombre de esa cuenta.

Esto ya esta configurado a nivel de este repo (no afecta tu configuracion global de git):

```bash
git config user.name "Enterdev SAS"
git config user.email "130387196+enterdevsas@users.noreply.github.com"
```

Para subir cambios, usa el script `scripts/push.sh` (reaplica esa configuracion automaticamente antes de cada push):

```bash
./scripts/push.sh "mensaje del commit"
```

Si clonas el repo en otra maquina, repite el `git config` de arriba antes del primer commit para evitar que Vercel vuelva a bloquear el deploy por autoria incorrecta.

## 4. Checklist post-deploy

- [ ] Login con un usuario admin funciona.
- [ ] Crear un pedido de prueba y verificar el flujo de estados.
- [ ] Adjuntar un archivo y confirmar que el link firmado de Supabase Storage funciona.
- [ ] Confirmar que `SUPABASE_SERVICE_ROLE_KEY` NO esta en las variables de entorno del hosting (solo como secreto de la Edge Function).
- [ ] Confirmar que el schema `dromedario` esta expuesto en Supabase (paso 0.3.2).

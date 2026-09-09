# Build Instructions

## Prerequisites
- Node.js 20 or newer recommended.
- Supabase project with `supabase/schema.sql` applied.
- Supabase API exposed schema includes `dromedario`.
- Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Build Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env.local
# edit .env.local with the Supabase URL and anon key
```

### 2.1 Configure Supabase API Schema
In Supabase Project Settings, API, Exposed schemas, add `dromedario`.

### 3. Run Checks
```bash
npm run test
npm run typecheck
npm run build
```

### 4. Verify Build Success
- Expected output: Next.js production build completes without TypeScript errors.
- Build artifacts: `.next/`.

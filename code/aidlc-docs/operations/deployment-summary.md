# Operations - Deployment Configuration Summary

**Stage**: OPERATIONS - Deployment Configuration
**Status**: Complete
**Date**: 2026-09-08

## Decision

User selected Option A in `aidlc-docs/session-resume-questions.md`: continue to OPERATIONS and prepare/document the Supabase + Vercel/Netlify deployment configuration for the already-built MVP.

## Deliverables (at workspace root, not under aidlc-docs/, per Code Location Rules)

- `netlify.toml` - build command, `@netlify/plugin-nextjs` plugin, Node 20 pin.
- `DEPLOYMENT.md` - full guide: prerequisites (GitHub remote, env vars, Supabase schema + Edge Function), step-by-step for Vercel and Netlify, post-deploy checklist.
- `README.md` - deploy section simplified to point at `DEPLOYMENT.md`.

## Recommendation

Vercel as the primary deploy target: Next.js (App Router, `app/api` routes) is natively supported with zero extra configuration, and Vercel supports new Next.js releases (this project uses 16.x) on day one. Netlify is fully documented and configured as a supported alternative (via `netlify.toml` + `@netlify/plugin-nextjs`) in case the client wants to consolidate hosting there.

## Open items for the client (not yet executed)

- Repository has no `origin` remote configured yet (`git remote -v` is empty) - required before connecting either Vercel or Netlify via Git integration.
- Environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) must be set in whichever platform is chosen.
- `admin-create-user` Edge Function secret (`SUPABASE_SERVICE_ROLE_KEY`) must be set via `supabase secrets set`, never in the hosting platform's env vars.

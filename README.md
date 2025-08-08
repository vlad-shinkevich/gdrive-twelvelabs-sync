# TwelveLabs Sync Monorepo

Modern monorepo powered by pnpm workspaces and TurboRepo. Web app is built with Next.js 15 (App Router) and React 19. Shared UI lives in a separate package.

### Project structure

```
gdrive-twelvelabs-sync/
├─ apps/
│  └─ web/                 — Next.js 15 app (App Router)
│     ├─ app/              — routes, layouts, pages, API routes
│     ├─ components/       — app-specific components (e.g. login form, providers)
│     ├─ hooks/            — app hooks (placeholder)
│     ├─ lib/              — app utilities (placeholder)
│     ├─ next.config.mjs   — Next.js config
│     ├─ postcss.config.mjs— PostCSS config
│     ├─ tsconfig.json     — TypeScript config for the app
│     └─ package.json      — app scripts
├─ packages/
│  ├─ ui/                  — shared UI library (shadcn/ui style, Tailwind v4)
│  │  ├─ src/components/   — reusable components (e.g. button.tsx)
│  │  ├─ src/lib/          — shared utils (e.g. utils.ts)
│  │  ├─ src/styles/       — global styles (globals.css)
│  │  ├─ postcss.config.mjs— PostCSS for the UI package
│  │  └─ package.json      — package exports
│  ├─ eslint-config/       — shared ESLint configs (base/next/react-internal)
│  └─ typescript-config/   — shared tsconfig presets (base/nextjs/react-library)
├─ package.json            — root scripts (turbo build/dev/lint)
├─ pnpm-workspace.yaml     — workspace definition (apps/*, packages/*)
├─ turbo.json              — Turbo tasks pipeline
├─ pnpm-lock.yaml          — pnpm lockfile
├─ tsconfig.json           — root tsconfig
└─ README.md               — this file
```

### Scripts

- Root:
  - `pnpm dev` — start all dev tasks via Turbo (will run `apps/web`)
  - `pnpm build` — build all packages/apps
  - `pnpm lint` — lint
  - `pnpm format` — prettier
- `apps/web`:
  - `pnpm dev` — `next dev --turbopack`
  - `pnpm build` — `next build`; `pnpm start` — `next start`
  - `pnpm lint`, `pnpm lint:fix`, `pnpm typecheck`

### UI usage

Import from `@workspace/ui` according to exports in `packages/ui/package.json`.

```tsx
import { Button } from "@workspace/ui/components/button"
```

### Authentication

- Login page: `apps/web/app/login/page.tsx` uses `LoginForm` (`apps/web/components/login-form.tsx`) with `supabase.auth.signInWithPassword`.
- Middleware: `apps/web/middleware.ts` uses `@supabase/ssr` to read Supabase session cookies and redirect unauthenticated users to `/login`. It allows `/login` and all of `/api`.

Environment variables (Vercel → Project → Settings → Environment Variables):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Notes:
- Supabase Site URL: in dev keep `http://localhost:3000`. For production set your Vercel domain. Add both dev and prod domains to Allowed Redirect URLs and CORS Origins.
- Because middleware excludes `/api`, any private API you add should validate the Supabase session inside the handler (or remove the exclusion and protect via middleware).
- Test route: `GET/POST /api/supabase-test` checks DB connectivity (table `todos`).

### Local development

1) Install deps: `pnpm install`
2) Create `apps/web/.env.local` with:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

3) Run: `pnpm dev`
4) Create a user (dev): via Supabase Studio or Admin API. Example (server-only key):

```
curl -s -X POST "$SUPABASE_URL/auth/v1/admin/users" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"StrongPass!123","email_confirm":true}'
```

### Deployment (Vercel)

 - Set the same Supabase env vars in Vercel for Production/Preview/Development.
 - Any new deployment (new commit/merge or Redeploy) will pick up updated env. Changing Supabase Site URL/Redirects in Supabase does not require a redeploy.

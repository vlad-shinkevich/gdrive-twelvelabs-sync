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

- Login page: `apps/web/app/login/page.tsx` uses `LoginForm` from `apps/web/components/login-form.tsx`.
- API login: `apps/web/app/api/login/route.ts` checks credentials from env and sets an httpOnly cookie `auth_token`.
- Middleware: `apps/web/middleware.ts` allows `/login` and all of `/api`, but protects other routes by comparing cookie `auth_token` with `AUTH_TOKEN` from env. If not valid → redirect to `/login`.

Environment variables (Vercel → Project → Settings → Environment Variables):
- `APP_LOGIN_USER`
- `APP_LOGIN_PASS`
- `AUTH_TOKEN` (any secure random string; used as cookie value and checked in middleware)

Notes:
- Cookie flags: httpOnly, secure in production, sameSite=strict, path=/.
- Middleware environment is baked at build time. Changing env in Vercel requires a new deployment to take effect for middleware.
- Because middleware excludes `/api`, any private API route you add later must validate `auth_token` inside the handler:

```ts
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function GET() {
  const token = cookies().get("auth_token")?.value
  if (!token || token !== process.env.AUTH_TOKEN) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }
  return NextResponse.json({ ok: true })
}
```

### Local development

1) Install deps: `pnpm install`
2) Create `apps/web/.env.local` with:

```
APP_LOGIN_USER=your_login
APP_LOGIN_PASS=your_password
AUTH_TOKEN=your_secure_random_token
```

3) Run: `pnpm dev`

### Deployment (Vercel)

- Set the same env vars in Vercel for Production/Preview/Development.
- Any new deployment (new commit/merge or Redeploy) will pick up updated env. Middleware requires a new deployment to read updated env.

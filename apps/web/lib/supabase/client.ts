import { createBrowserClient } from "@supabase/ssr"

// Use browser client so auth session is stored in cookies that middleware/server can read
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)



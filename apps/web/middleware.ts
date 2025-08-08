import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Даем доступ к логину без авторизации
  if (pathname.startsWith("/login") || pathname.startsWith("/api/login")) {
    return NextResponse.next()
  }

  const expectedToken = process.env.AUTH_TOKEN
  const token = req.cookies.get("auth_token")?.value

  if (!expectedToken || !token || token !== expectedToken) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  return NextResponse.next()
}

export const config = {
  // Исключаем API-роуты и служебные ресурсы
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}

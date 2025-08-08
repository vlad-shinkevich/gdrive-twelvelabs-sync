import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json()

    // Логин и пароль из переменных окружения
    const envUser = process.env.APP_LOGIN_USER
    const envPass = process.env.APP_LOGIN_PASS
    const authToken = process.env.AUTH_TOKEN

    if (!envUser || !envPass || !authToken) {
      return NextResponse.json(
        { success: false, message: "Server auth is not configured" },
        { status: 500 }
      )
    }

    // Простая, но безопасная проверка
    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      username.trim() !== envUser || password !== envPass
    ) {
      return NextResponse.json({ success: false, message: "Invalid credentials" }, { status: 401 })
    }

    // Ставим cookie
    const res = NextResponse.json({ success: true })
    res.cookies.set("auth_token", authToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/"
    })
    return res
  } catch {
    return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 })
  }
}

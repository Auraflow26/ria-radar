import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const pw = process.env.SITE_PASSWORD
  if (!pw) return NextResponse.json({ ok: true }) // gate disabled

  let password = ''
  try {
    ;({ password } = await req.json())
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  if (password !== pw) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set('ria_access', pw, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  })
  return res
}

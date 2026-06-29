import { NextResponse, type NextRequest } from 'next/server'

// Cookie-based password gate with a branded form (not native Basic Auth).
// When SITE_PASSWORD is set, an unauthenticated request is redirected to /gate,
// which posts the password and sets an httpOnly access cookie. Friendly single
// box, no username confusion, and a shareable experience for a non-technical viewer.
export function middleware(req: NextRequest) {
  const pw = process.env.SITE_PASSWORD
  if (!pw) return NextResponse.next() // unset → open (local dev)

  const { pathname } = req.nextUrl
  // allow the gate page itself + its API + robots through
  if (pathname.startsWith('/gate') || pathname.startsWith('/api/gate') || pathname === '/robots.txt') {
    return NextResponse.next()
  }

  const cookie = req.cookies.get('ria_access')?.value
  if (cookie === pw) return NextResponse.next()

  const url = req.nextUrl.clone()
  url.pathname = '/gate'
  url.searchParams.set('next', pathname)
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

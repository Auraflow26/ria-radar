import { NextResponse, type NextRequest } from 'next/server'

// App-level password gate (defense-in-depth alongside Vercel Deployment
// Protection). When SITE_PASSWORD is set, every request needs HTTP Basic auth.
// Robots are blocked separately; this stops human access to the named list.
export function middleware(req: NextRequest) {
  const pw = process.env.SITE_PASSWORD
  if (!pw) return NextResponse.next() // unset → open (local dev)

  const auth = req.headers.get('authorization')
  if (auth) {
    const [, encoded] = auth.split(' ')
    try {
      const [, pass] = atob(encoded).split(':')
      if (pass === pw) return NextResponse.next()
    } catch {
      // fall through to challenge
    }
  }
  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="RIA Radar — restricted"' },
  })
}

export const config = {
  // gate everything except Next internals + the robots file
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt).*)'],
}

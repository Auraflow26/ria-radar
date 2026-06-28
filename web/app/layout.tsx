import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'RIA Radar — KKR RIA Project',
  description: 'Ranked RIA call list + grounded pre-meeting briefs from public SEC Form ADV data.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans min-h-screen">
        <header className="border-b border-[rgba(139,92,246,0.12)] px-6 py-4 flex items-baseline justify-between">
          <div>
            <h1 className="text-lg font-bold text-text-primary">
              RIA Radar <span className="text-accent-light">·</span>{' '}
              <span className="text-text-secondary font-medium">KKR RIA Project</span>
            </h1>
            <p className="text-xs text-text-muted mt-0.5">
              Ranked alts-readiness from public SEC Form ADV — research demo, not investment advice.
            </p>
          </div>
          <nav className="flex items-center gap-4">
            <a href="/" className="text-xs text-text-secondary hover:text-accent-light">Ranked list</a>
            <a href="/method" className="text-xs text-text-secondary hover:text-accent-light">Methodology</a>
          </nav>
        </header>
        <main className="px-6 py-6 max-w-7xl mx-auto">{children}</main>
      </body>
    </html>
  )
}

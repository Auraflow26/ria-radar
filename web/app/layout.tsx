import './globals.css'
import type { Metadata } from 'next'
import { ChatWidget } from '@/components/ChatWidget'
import { Onboarding } from '@/components/Onboarding'

export const metadata: Metadata = {
  title: 'KKR RIA Intelligence',
  description: 'Ranked RIA call queue + grounded pre-meeting briefs from public SEC Form ADV data.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans min-h-screen bg-bg">
        <header className="bg-bg-secondary border-b border-[rgba(0,163,224,0.25)] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold tracking-tight text-accent text-xl">KKR</span>
            <div>
              <h1 className="text-sm font-semibold text-text-primary leading-tight">RIA Intelligence</h1>
              <p className="text-[11px] text-text-muted leading-tight">
                Alts-readiness from public SEC Form ADV
              </p>
            </div>
          </div>
          <nav className="flex items-center gap-5">
            <a href="/" className="text-xs text-text-secondary hover:text-accent">Call queue</a>
            <a href="/watch" className="text-xs text-text-secondary hover:text-accent">Alerts</a>
            <a href="/ask" className="text-xs text-text-secondary hover:text-accent">Ask the data</a>
            <a href="/memo" className="text-xs text-text-secondary hover:text-accent">How I&apos;d work it</a>
            <a href="/method" className="text-xs text-text-secondary hover:text-accent">Methodology</a>
          </nav>
        </header>
        <main className="px-6 py-6 max-w-7xl mx-auto min-h-[70vh]">{children}</main>
        <footer className="border-t border-[rgba(0,163,224,0.15)] px-6 py-4 mt-8">
          <p className="text-[11px] text-text-dim max-w-7xl mx-auto">
            KKR RIA Intelligence · Powered by public SEC Form ADV data · Research demo — not investment advice.
          </p>
        </footer>
        <ChatWidget />
        <Onboarding />
      </body>
    </html>
  )
}

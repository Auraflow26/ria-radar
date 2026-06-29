import { GateForm } from '@/components/GateForm'

export const metadata = { title: 'RIA Radar — access' }

export default async function GatePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams
  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="w-full max-w-sm bg-bg-card border border-[rgba(0,163,224,0.12)] rounded-card p-6">
        <h1 className="text-lg font-bold text-text-primary">RIA Radar</h1>
        <p className="text-xs text-text-muted mt-1 mb-5">
          Private research demo — enter the access password to continue.
        </p>
        <GateForm next={next ?? '/'} />
        <p className="text-[11px] text-text-dim mt-5">
          Public SEC data · research demo · not investment advice.
        </p>
      </div>
    </div>
  )
}

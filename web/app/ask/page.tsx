import { AskChat } from '@/components/AskChat'

export const metadata = { title: 'Ask the data — RIA Radar' }

const SUGGESTIONS = [
  'Which firms in Texas have Schwab custody?',
  'Who has the most private funds in the top 30?',
  'Show me New York firms over $10B with alts exposure.',
  'Which firms market private-markets capability on their site?',
]

export default function AskPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold text-text-primary">Ask the data</h2>
      <p className="text-sm text-text-muted mt-1 mb-5">
        Natural-language questions answered <strong>only</strong> from the ranked firm list — cited, and it says so when
        something isn&apos;t in the data. Same no-hallucination discipline as the briefs.
      </p>
      <AskChat suggestions={SUGGESTIONS} />
    </div>
  )
}

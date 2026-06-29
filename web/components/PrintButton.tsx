'use client'

// One-click meeting-prep PDF: opens the browser print dialog (print stylesheet
// in globals.css renders a clean white sheet). No deps, no server, no sensitive data.
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print text-xs border border-[rgba(0,163,224,0.35)] text-accent rounded-input px-3 py-1.5 hover:bg-bg-elevated transition-colors"
    >
      ⤓ Export brief (PDF)
    </button>
  )
}

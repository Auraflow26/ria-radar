/**
 * Data source endpoints. Monthly zip URLs are an explicit hand-checked list —
 * the SEC's filename suffixes are inconsistent (`_0`, `-exemptzip`), so never
 * generate these by template.
 */

export const SEC_USER_AGENT = 'ria-radar research demo (mo@auraflowusa.com)'

const BULK_BASE =
  'https://www.sec.gov/files/investment/data/other/information-about-registered-investment-advisers-exempt-reporting-advisers'

export interface MonthlySource {
  /** YYYY-MM label used in cache filenames and reports */
  label: string
  url: string
}

/** Current snapshot — drives the ranked list. */
export const CURRENT_MONTH: MonthlySource = {
  label: '2026-06',
  url: `${BULK_BASE}/ia060126_0.zip`,
}

/** Prior snapshot — joined by CRD for the AUM-growth signal. */
export const PRIOR_MONTH: MonthlySource = {
  label: '2026-05',
  url: `${BULK_BASE}/ia050126.zip`,
}

/** Full ADV (Part 1A incl. Schedule D) as PDF, per firm. */
export const advPdfUrl = (crd: number) =>
  `https://reports.adviserinfo.sec.gov/reports/ADV/${crd}/PDF/${crd}.pdf`

/** SEC fair-access guidance: stay well under 10 req/s. */
export const SEC_REQUESTS_PER_SECOND = 2

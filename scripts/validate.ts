import { runValidation, printValidationReport } from '../src/lib/validation.js'

const ok = printValidationReport(runValidation())
process.exit(ok ? 0 : 1)

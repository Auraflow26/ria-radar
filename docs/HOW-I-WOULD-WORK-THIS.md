# How I'd work the RIA channel — a first pass

*A working note, not a pitch. Built from public SEC Form ADV data on the full
US wealth-channel adviser universe. Research demo — not investment advice.*

---

## The problem as I see it

You don't have a *data* problem — the RIA list is for sale from a dozen vendors.
You have a **prioritization and preparation** problem: ~2,100 in-scope advisers,
a finite number of wholesalers, and a partner asking "who did you call and why."
The work that matters is **who to call first, and what to open with.**

So I built the thing I'd want a new analyst to hand me: every firm scored on
alts-readiness from its own filing, re-rankable by desk, with a one-page brief
where every number traces back to the source.

---

## How I read "ready"

Eight signals, from the ADV. The two that carry the most weight, because they
gate everything else:

1. **HNW client mix** — evergreen/semi-liquid product needs qualified buyers. A
   mass-affluent book can't allocate no matter how interested.
2. **Existing private-fund machinery** — a firm already advising private funds
   has done the operational and diligence lift. Shortest path to a first ticket.

Then scale, custody (the distribution rails), discretion (can they implement a
model across households), growth, and what they say on their own site. Missing
data lowers confidence — it never invents a penalty.

**It's deterministic.** The score is arithmetic I can defend line-by-line, not a
model's opinion. The AI only writes the prose, and a gate rejects any brief whose
figures don't trace to the filing.

---

## Where I'd start this week (balanced view)

| # | Firm | Where | RAUM | Custodian | PFs | Why first |
|---|------|-------|-----:|-----------|----:|-----------|
| 1 | Bailard | Foster City, CA | $7.6B | Schwab | 1 | HNW book on a Schwab alts platform; one fund already — room to add |
| 2 | Davenport | Richmond, VA | $24.7B | Pershing | 3 | Scale + three private funds; operational rails proven |
| 3 | Allegheny Financial | Pittsburgh, PA | $5.6B | Fidelity | 13 | Thirteen funds — this firm *lives* in alts; warm conversation |
| 4 | Tocqueville | New York, NY | $10.2B | Pershing | 5 | Manhattan HNW, five funds, established shelf |
| 7 | Fiduciary Trust Intl | Lincoln, MA | $7.7B | Fidelity | 7 | Trust-company HNW depth + seven funds |

*Full 500 ranked in the live tool; top 75 carry a grounded brief.*

---

## Why this isn't a vendor list

- **Re-ranks by desk.** A credit desk and a PE desk shouldn't open the same
  firms. Flip the lens and the order changes by 200+ positions — Allegheny's
  thirteen funds float a credit desk to the top; a high-HNW, no-fund firm floats
  a PE desk's. Same universe, your priorities.
- **Numbers can't lie.** The grounding gate has caught a real hallucination in
  testing and blocked the brief. You can put this in front of a client.
- **It learns from you.** Log a call outcome and it nudges the next ranking. A
  bought list is frozen the day you buy it; this is tuned to your wins by quarter.

---

## What I'd do next (with you, not for you)

1. **Tune "ready" to your actual book** — your closed allocations re-weight the
   signals; the model stops being my guess and becomes your edge.
2. **Map to territories + existing relationships** — "who to call in your region
   you haven't touched," once I can see your CRM.
3. **Widen the brief depth** — 75 today is a demo; the pipeline runs to the full
   universe on a cheaper model with the same grounding gate.

That's the difference between buying rows and bringing judgment. The tool is just
how I keep the judgment current and honest.

— Mo

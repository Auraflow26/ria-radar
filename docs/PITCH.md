# Pitch kit — RIA Radar (analyst framing)

> Positioning: you're an analyst who did the homework on their universe and built
> the tooling to keep it current — NOT a vendor selling software. The tool is
> evidence of how you think. Lead with judgment, not features.

---

## A. The outreach note (short — for the first message)

> Hi Matt —
>
> I spent some time on the RIA distribution problem from your side: ~2,000
> wealth-channel advisers, finite wholesalers, and the real question being *who
> to call first and what to open with* — not *who are the RIAs* (that list is for
> sale).
>
> So I pulled the full SEC Form ADV universe, scored every firm on
> alternatives-readiness, and built a working tool around it. It re-ranks by desk
> (a credit desk and a PE desk shouldn't call the same firms first), every
> pre-meeting brief has its numbers checked against the source filing, and there's
> a guide you can just ask.
>
> Here's how I'd work the list: [link] (password: <set one>). The "How I'd work
> it" page is the 2-minute version.
>
> Public SEC data, research demo — but it's the kind of thing I'd want running on
> day one. Happy to walk you through it.
>
> — Mo

*Keep it that short. The link does the talking. Send the `/memo` framing first.*

---

## B. The 2-minute live walkthrough (if you screen-share)

1. **Open on `/memo`** (15s) — "This is how I read your universe. Two signals
   gate everything: HNW mix and existing private-fund machinery." Read the top-5
   table.
2. **Go to the list, hit a desk lens** (30s) — "Same 2,000 firms. Watch what
   happens when I rank for a credit desk." Click *Private credit desk* — Mill
   Creek jumps, the subtitle changes. "That's the thesis, not a static list. No
   vendor lets you do that."
3. **Open a top firm's brief** (45s) — "Every brief is grounded. Here's the
   suggested angle, conversation starters." Click *view source data* — "and every
   number traces to the filing. A gate rejects the brief if anything doesn't.
   It's caught a real hallucination in testing. You can put this in front of a
   client."
4. **Ask the guide** (20s) — type *"who has the most private funds in the top
   30?"* — "It answers only from the data, cited. Ask it how the score works too."
5. **Close** (10s) — "It learns from your call outcomes, and it'd tune to your
   actual closed allocations. That's the difference between buying rows and
   bringing judgment."

---

## C. Anticipated questions

- **"Is this just scraped vendor data?"** — No. Public SEC Form ADV, scored with
  a deterministic model I can defend line-by-line. The AI only writes prose, never
  numbers, and a gate enforces it.
- **"Compliance?"** — Public data only, clearly labeled research/not-advice, and
  the grounding gate means no fabricated figures. Access is gated; nothing is
  indexed.
- **"How current?"** — Monthly SEC roster + the live per-firm ADV PDF for the
  enriched set. Refreshes on a schedule.
- **"Can it do our desks / our book?"** — Yes — lenses are configurable, and the
  feedback loop tunes the model to your closed allocations over time.

---

## D. What NOT to say

- Don't call it a "product" or "platform you can license." It's a working
  analysis.
- Don't oversell depth — be straight: top 150 published, top 75 briefed, demo
  scale; the pipeline runs to the full universe on a cheaper model.
- Don't hide limits — the `/method` page lists them. Naming them builds trust.

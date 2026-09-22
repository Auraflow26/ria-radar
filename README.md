# RIA Radar

**15,000+ SEC Form ADV filings → a ranked RIA call list + meeting-ready briefs. One command.**

```bash
npx tsx scripts/run.ts
```

## The problem

A private-markets wealth team covering the RIA channel has ~17,000 registered advisers and a finite number of wholesalers. Everyone already has the list. The real questions are **who do you call first** and **what do you say when they pick up**.

RIA Radar answers both, using only public data.

## What you get

- **Ranked call list** (`output/ranked-rias.html` / `.csv`) — every US wealth-channel RIA scored 0–100 on alts-readiness, with the full evidence behind each score one click away. "Why is this firm #3?" answers itself.
- **Pre-meeting briefs** (`output/briefs/`) — one page per top firm: ADV snapshot, why they're ready (every number cited to the filing), current alts footprint, suggested angle, three discovery questions. Print to PDF, walk in.

Sample run committed in `output/sample/`.

## How it works

# Aviation Monorepo

[![CI/CD Status](https://github.com/jordanhubbard/Aviation/actions/workflows/ci.yml/badge.svg)](https://github.com/jordanhubbard/Aviation/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A monorepo of aviation-related applications with shared CI/CD, keystore-based secrets, and common packages. See [docs/](docs/) for setup and architecture.

**Prerequisites:** Node.js 20+, npm 9+, Python 3.11+ (for Python apps), Java 11+ (for Clojure).

```bash
git clone https://github.com/jordanhubbard/Aviation.git && cd Aviation
npm install
npm run keystore:init   # one-time
```

## Running the apps

| App | How to run |
|-----|------------|
| **Meta App** (all-in-one UI) | `cd apps/meta-app && make dev` → http://localhost:3100 |
| **Aviation Accident Tracker** | `cd apps/aviation-accident-tracker && make docker-up` (frontend 5173, backend 3002) or `make start` for backend only |
| **Aviation Missions App** | `cd apps/aviation-missions-app && make start` (port 3000) |
| **Flight Planner** | Backend: `cd apps/flight-planner && .venv/bin/uvicorn backend.main:app --reload --port 8000` — Frontend: `cd apps/flight-planner/frontend && npm run dev` |
| **Flight School** | `cd apps/flightschool && make demo` or `make start` (port 5000) |
| **ForeFlight Dashboard** | `cd apps/foreflight-dashboard && make start` or `make dev` |
| **Flight Tracker** | `cd apps/flight-tracker && npm run build && npm start` (port 3001) |
| **Weather Briefing** | `cd apps/weather-briefing && npm run build && npm start` (port 3002) |

From repo root: `make build` / `make test` / `make help` for global build and test.

## Secrets

```bash
npm run keystore set <service-name> <KEY> "value"
npm run keystore get <service-name> <KEY>
npm run keystore list <service-name>
```

In code: use `@aviation/keystore` (TypeScript) or `keystore` (Python). See [docs/KEYSTORE_SETUP.md](docs/KEYSTORE_SETUP.md).

## Shared packages

- **@aviation/keystore** — Encrypted secrets (TypeScript + Python)
- **@aviation/shared-sdk** — Common service patterns and SDK
- **@aviation/ui-framework** — Multi-tab / multi-modal UI

## Repo layout

```
apps/          — aviation-accident-tracker, aviation-missions-app, flight-planner,
                 flightschool, foreflight-dashboard, flight-tracker, weather-briefing, meta-app
packages/      — keystore, shared-sdk, ui-framework
docs/          — Setup, architecture, security, secrets
```

## Docs and contributing

- [Getting started](docs/GETTING_STARTED.md) · [Architecture](docs/ARCHITECTURE.md) · [Contributing](CONTRIBUTING.md) · [AGENTS.md](AGENTS.md) (LLM/automation)

## Legal

This software is for **educational use only** and is **not approved for flight training or real-world flight operations**. See [LEGAL.md](LEGAL.md).

---

## The Totally True and Not At All Embellished History of Aviation

### The continuing adventures of Jordan Hubbard and Sir Reginald von Fluffington III

> *Part 4 of an ongoing chronicle.  [← Part 3: NanoLang](https://github.com/jordanhubbard/nanolang#the-totally-true-and-not-at-all-embellished-history-of-nanolang) | [Part 5: WebMux →](https://github.com/jordanhubbard/webmux#the-totally-true-and-not-at-all-embellished-history-of-webmux)*
> *Sir Reginald von Fluffington III appears throughout.  He does not endorse any of it.*

The programmer was, among other things, a pilot.

He did not mention this often, partly because "pilot" is a word that attracts a specific kind of conversation — people who want to tell you about their cousin who once flew a Cessna, and people who have strong opinions about Boeing — and partly because the programmer had learned, over time, that the best way to describe his relationship with aviation was "complicated."

Sir Reginald von Fluffington III had no opinion on aviation.  He had opinions on many things — the precise location of his food bowl, the acceptable ambient temperature, the fundamental injustice of closed doors, the specific failure mode of every programming project the programmer had attempted since 2024 — but aviation fell into the category of Events That Happen Above Sir Reginald and are therefore irrelevant.

"Reggie," the programmer said one morning, spreading a sectional chart across the kitchen table in a way that covered Sir Reginald's preferred napping spot, "I have noticed a gap in the market."

Sir Reginald had been in the act of getting comfortable.  He was now not comfortable.  He noted this in his internal ledger under "grievances, aviation-related."

"I need a flight planning app," the programmer continued.  "And a logbook analyzer.  And a weather briefing tool.  And something to track aviation accidents, because I find that information professionally useful and not at all anxiety-inducing.  And a mission management system — I'm not sure exactly what that means yet, but the word 'mission' has a satisfying weight to it.  And a flight school management system.  And a real-time flight tracker.  And something to tie all of it together into a unified dashboard."

Sir Reginald looked at him with the expression of a creature who has counted to eight and found the number troubling.

"That's a monorepo," the programmer said, with the tone of a man who has just solved his own problem by naming it.  "Eight applications.  Three shared packages.  Unified CI/CD.  It will be elegant."

Sir Reginald left the room.  He had learned what "elegant" meant.

What followed was a period the programmer described as "systematic" and which the commit history describes as "at least it has good documentation."  TypeScript emerged first, because TypeScript is what you choose when you need JavaScript but would like it to occasionally argue with you about types, and the programmer had grown to value arguments about types.  Python followed, for the applications requiring data analysis and the kind of algorithmic complexity that TypeScript finds distressing.  Then, in a decision the programmer describes as "principled" and which everyone else describes as "explain it to me again, slowly," Clojure — because the aviation missions app required a data model most naturally expressed in immutable persistent data structures, and because the programmer had once read a book about functional programming and had never fully recovered.

"The Beads pattern," the programmer told Sir Reginald, who had returned and was now sitting in the open Clojure documentation in a way that covered the section on sequences, "is a method for decomposing work into parallelizable units.  Like beads on a string.  Independent beads run simultaneously.  It scales beautifully."

Sir Reginald shifted his weight to cover the section on transducers.  He found transducers irrelevant, but he found everything the programmer was excited about irrelevant, and at least sitting on the page meant the programmer couldn't read it and would have to slow down.

The encrypted keystore materialized because the programmer was tired of secrets in environment variables, a practice he described as "hiding your house key under the mat but in a way that requires a computer science degree to locate."  The keystore had TypeScript and Python clients.  All eight applications used it.  Sir Reginald, who keeps his secrets by the simpler method of refusing to speak, found this unnecessarily complicated, but did not say so, because he never says anything.

The G1000 simulator came later, because the programmer was working on his instrument rating and felt that the best way to learn a thing was to build a model of it.  The flight school management system came because the programmer knew people who taught flying.  The accident tracker came because engineers find patterns in data comforting, especially data about things going wrong, and the programmer was, at heart, an engineer.

The legal disclaimer was, in a sense, Sir Reginald's doing.  The programmer had been about to describe the flight planner as suitable for actual pre-flight planning when Sir Reginald walked across the keyboard, selected the relevant clause, and deleted it.  What remained was more accurate.  The programmer added a `LEGAL.md` explaining that nothing in this software was approved for real flight operations — because it was not, and because saying so explicitly is the kind of thing that separates "educational tool" from "liability."

*NOT for actual flight training*, it reads, which Sir Reginald would endorse if he endorsed anything, which he does not.

As of this writing, the Aviation monorepo contains eight applications in three languages, three shared packages, a CI/CD pipeline that runs security scans on every commit, and a legal disclaimer that the software is not for use in actual flight operations — a fact Sir Reginald considered self-evident from the moment he saw the sectional chart on his spot.  Sir Reginald continues to withhold his endorsement across all five projects, citing "procedural concerns," "insufficient tuna," "a general atmosphere of hubris," and, most recently, in a written statement delivered by sitting directly on top of the keyboard during preflight calculations, "aviation."

What the programmer did next — building a web-native terminal multiplexer because he was tired of tmux — is documented in [Part 5: WebMux](https://github.com/jordanhubbard/webmux#the-totally-true-and-not-at-all-embellished-history-of-webmux).

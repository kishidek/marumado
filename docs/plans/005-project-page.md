# 005 · Project page

| | |
|---|---|
| **Status** | **Done** · live at https://marumado.danielkishimoto.com since 2026-10-05 |
| **Created** | 2026-10-05 |
| **Updated** | 2026-10-05 |
| **Supersedes** | — |
| **Superseded by** | — |
| **Live status** | [tracker.md](../tracker.md) → Post-MVP |

## 1. Goal

A public page that shows what Marumado is, lets people install it, and points to the code, living with the author's other experiments.

## 2. Decisions (2026-10-05)

| Topic | Decision |
|---|---|
| **Where** | The (private) `playground` monorepo, as `apps/marumado` → **marumado.danielkishimoto.com** (Cloudflare Worker, assets only), listed as case 03 on playground.danielkishimoto.com. Auto-deployed by the monorepo's GitHub Action on push to `main` |
| **Design** | **Marumado's own identity** (paper, indigo, Shippori Mincho, colour clips), not SUMI: same exception as `gmc`. The landing card still degrades the thumbnail to grey (SUMI editorial, `mono`) |
| **Content** | Product page first (what it is, why, the four clips, privacy, install, GitHub), then a short **"How it was built"** section linking to `docs/` |
| **Credit / UTMs** | Links to GitHub and danielkishimoto.com carry `utm_source=marumado-site` |

## 3. Page outline

1. Hero: name + 丸窓, one line, the garden clip, buttons "Get it on GitHub" (releases) and "Source".
2. Why: the intro text from the help modal.
3. How it works: the four help clips with their lines.
4. Privacy: four short facts.
5. Install: release zip → load unpacked (Chrome / Edge); build from source.
6. How it was built: procedural three.js ajisai, pure-TS engine, terraced garden, 24 visual baselines, every bug logged; link to `docs/`.
7. Footer: MIT · made by Daniel Kishimoto · part of playground.

## 4. Steps

| # | Step | Status |
|---|---|---|
| P1 | Build `apps/marumado` on branch `marumado-page` of the playground repo (local commit, not pushed); copy clips and stills | ✅ 2026-10-05 |
| P2 | Landing card (case 03) + grey thumbnail | ✅ 2026-10-05 |
| P3 | Local preview (desktop, mobile, reduced motion) and review by the user | ✅ 2026-10-05 |
| P4 | Merge to `main` → auto-deploy; check the subdomain and the landing | ✅ 2026-10-05: deploy run green (`_landing` + `marumado`), page, media and landing card return 200 |
| P5 | First GitHub Release with the zip, so "Get it" works | ✅ v0.2.0 pre-release |

## 5. Notes

- Media is copied, not linked: if the clips are re-rendered (`npm run render:help`), copy them again into `apps/marumado/public/media/`.
- v0.2.0 was released before the page went live, so "Get it on GitHub" never pointed at an empty page.

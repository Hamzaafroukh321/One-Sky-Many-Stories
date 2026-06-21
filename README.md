# One Sky, Many Stories

An interactive web app concept for exploring how different sky cultures draw different meanings from the same stars.

The source of truth is the build specification in [docs/one-sky-many-stories-spec.md](docs/one-sky-many-stories-spec.md).

## Product Direction

One Sky, Many Stories is planned as a static Next.js app deployed on Vercel. The experience centers on a full-screen real star field, culture-specific constellation overlays, myth panels, and a compare mode that shows how different traditions connected the same physical stars.

## Documentation

- [Build specification](docs/one-sky-many-stories-spec.md)
- [Roadmap](docs/roadmap.md)
- [Attribution notes](docs/attribution.md)

## Planned Stack

- Next.js App Router
- TypeScript
- HTML Canvas 2D
- CSS custom properties
- Google fonts via `next/font/google`
- Static JSON data generated at build time

## Repository Status

This repository now contains the initial interactive implementation: a static Next.js sky atlas with real HYG star data, three culture overlays, constellation stories, compare mode, and an About / Sources panel.

## Getting Started

Install dependencies:

```bash
npm install
```

Generate the static sky data:

```bash
npm run build:data
```

Run the development server:

```bash
npm run dev
```

Verify the app:

```bash
npm run typecheck
npm run build
npm audit --omit=dev
```

The production build is static and exports to `out/`.

## Current Implementation

- Full-bleed Canvas 2D sky renderer
- 5,041 visible HYG stars with magnitude-scaled glow and subtle color temperature
- Greek, Chinese, and Polynesian/Hawaiian culture overlays
- Culture rail with accent transitions
- Pan, zoom, reset view, ambient drift, and reduced-motion handling
- Constellation story panel with source and license text
- Compare mode with ghost overlay
- About / Sources view with required attribution

## Data And Licenses

The planned app uses open sky datasets and must preserve visible attribution in the UI:

- HYG Database by David Nash / Astronexus, CC BY-SA 4.0
- Stellarium Sky Cultures, Creative Commons licenses varying by culture
- `doinab/constellation-lines`, Creative Commons licensed source data

Project code licensing has not been selected yet.

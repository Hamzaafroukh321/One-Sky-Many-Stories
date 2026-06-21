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

This repository currently contains the product and implementation specification. Application code should be added incrementally according to the phase plan in the spec.

## Data And Licenses

The planned app uses open sky datasets and must preserve visible attribution in the UI:

- HYG Database by David Nash / Astronexus, CC BY-SA 4.0
- Stellarium Sky Cultures, Creative Commons licenses varying by culture
- `doinab/constellation-lines`, Creative Commons licensed source data

Project code licensing has not been selected yet.

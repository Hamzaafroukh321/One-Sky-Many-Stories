# Roadmap

This roadmap summarizes the implementation phases from the build spec. The spec remains the source of truth.

## Phase 1: Skeleton

- Create the Next.js App Router project.
- Load Fraunces, Spectral, and Space Mono.
- Add the base design tokens.
- Render an empty full-bleed canvas on the void background.

## Phase 2: Stars

- Add the build-time data script.
- Download and parse HYG stars.
- Filter to visible stars.
- Render magnitude-scaled stars with subtle color and glow.

## Phase 3: Motion And Navigation

- Add pan and zoom.
- Add ambient drift and star twinkle.
- Fully honor `prefers-reduced-motion`.

## Phase 4: First Culture

- Render Greek constellation lines.
- Add draw-on entrance animation.
- Skip missing Hipparcos IDs safely.

## Phase 5: Culture Switching

- Add the bottom culture rail.
- Add Chinese and Polynesian/Hawaiian datasets.
- Implement same-stars morph transitions.
- Tween culture accent colors.

## Phase 6: Story Panel

- Open a story panel when a constellation is selected.
- Include native name, romanization, myth text, source, and license.
- Add Escape-to-close and focus states.

## Phase 7: Compare Mode

- Let users pin one culture as a ghost overlay.
- Render active and pinned cultures over the same stars.
- Add a compact legend.

## Phase 8: Polish

- Add hover states and constellation labels.
- Add mobile bottom-sheet layouts.
- Add About / Sources view.
- Add favicon and share metadata.
- Verify no console errors.

## Phase 9: Stretch

- Search stars and constellations.
- Orient the sky from device location.
- Add timeline or precession experiments.
- Consider a 3D sphere after the Canvas version is complete.

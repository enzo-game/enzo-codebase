# Claude Handoff: `/journey` Mode A Layout Pass

> Date: 2026-07-11
> Scope owner in this pass: Codex
> Do not edit `.claude/` as part of this handoff.

## Goal

Mode A should read as a journey board, not a dashboard. The main visual path is:

1. Where am I on the mountain route?
2. What is my next action?
3. What action cards can help?

## Changed

- `src/app/journey/page.tsx`
  - Added ordering classes to the major page sections.
  - Moved visual priority so `山徑路線` renders before the quest/action panel.
  - Reduced the initial interruption stack: first load no longer auto-chains opening legend, start-node story, and coach overlay after the chapter card.
  - Added `jny-step-card`, `jny-sidequests`, `jny-hand-board`, `jny-hand-scroll`, and related layout hooks.

- `src/app/globals.css`
  - Added `.jny-shell` section ordering.
  - Made route map the first major content block after the level strip.
  - Compressed the route nodes and action panel so a 1280x720 viewport shows the journey map, the next action, and the top edge of the action-card row.
  - Changed the action-card area into a bottom-feeling horizontal tool row without covering the main action panel.
  - Moved HUD/status/resources lower in the visual hierarchy.

## Intent

- Keep the game rules unchanged.
- Keep all card, quiz, audio, resource, and route logic unchanged.
- Reduce modal fatigue on first entry.
- Make the first screen feel like moving along a route.
- Let status bars and logs support the journey instead of dominating it.

## Validation

- `npx eslint src/app/journey/page.tsx` passes.
- `npm run build` passes.
- Browser check at 1280x720:
  - Only one opening card appears.
  - Main screen shows route map first.
  - Main action card is visible and not covered.
  - Action cards peek from the bottom and render correctly when scrolled.

## Next Visual Follow-Ups

- If the top header still feels too tall, reduce the title/header area before shrinking the route map.
- If the action cards should be more visible above the fold, reduce `.jny-quest-board` height first; do not hide the route map again.
- If adding tutorial back, use a small optional hint near the main action card instead of auto-opening a multi-step coach overlay.

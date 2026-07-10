# Claude Handoff: `/play` Hearthstone-Style Board UI

> Date: 2026-07-10
> Scope owner in this pass: Codex
> Important: Claude may be working concurrently on `/journey` and `.claude/`. Do not overwrite or normalize those changes while continuing this `/play` task.

## Project Goal

Mode B (`/play`) should feel like a Hearthstone-style card battle board, not a dashboard or generic web panel.

The intended first impression is:

- Opponent hand sits at the top as card backs.
- Opponent hero sits upper-center with HP attached.
- Minions live in two central board lanes.
- Player hero sits lower-center with HP attached.
- Mana and end-turn controls sit close to the board action.
- Player hand sits at the bottom as playable collectible cards.

This is an information-architecture reference to Hearthstone, not an asset copy. Keep Enzo/Truku visual identity and existing cultural-safety constraints.

## Files Changed For `/play`

- `src/app/play/page.tsx`
  - Reworked render structure around the board into `.hs-table`.
  - Added opponent hand fan via `.hs-opponent-hand` / `.hs-cardback-mini`.
  - Moved hero presentation into `.hs-portrait` blocks.
  - Added mana crystal strips via `.hs-resource-strip`.
  - Kept existing game logic, card data, quiz flow, combat rules, and sound behavior unchanged.

- `src/app/globals.css`
  - Added `/play` board styling starting around the `/play 爐石式卡框` section.
  - Added table, hero portrait, opponent hand, mana crystal, combat lane, hand rail, and log panel styles.
  - Added responsive rules for tablet/mobile breakpoints under the same `/play` CSS section.
  - Existing `.hs-card`, `.hs-gem`, `.hs-token` styles are still used by both hand cards and board minions.

- `PLAY_HEARTHSTONE_MODE.md`
  - Added a reusable explanation of the Hearthstone-style `/play` mode: player flow, board zones, visual direction, review checklist, and cultural safety rules.

- `CARD_EXPANSION_LEGEND_PROPOSAL.md`
  - Added a proposal for expanding from 32 main cards to 48 main cards.
  - Updated after the first 8 low-risk cards were implemented; the current main-card count is 40.
  - Flags rainbow bridge and Pusu Qhuni/Mawi-adjacent cards for cultural review before implementation.

- `src/data/cards.ts`
  - Added 8 low-risk Wave A cards: `遠行的柑橘`, `接力的道路`, `休息的夜`, `風停後的路`, `溪畔補給`, `山口逆風`, `石堆路標`, `火光守夜`.
  - Used only existing engine effects and verified existing vocabulary ids.
  - Added `CARD_LEARNING`, a required learning-note map for all 40 main cards + `leg-token-sapling`.
  - Build-time validation now fails if a card has no learning note.

- `public/images/cards/*`
  - Added 8 generated 384x480 JPG card artworks for the Wave A cards:
    `l12-citrus.jpg`, `l13-road.jpg`, `n08-night-rest.jpg`, `p06-after-wind-road.jpg`,
    `n09-creek-supply.jpg`, `n10-headwind-pass.jpg`, `p07-stone-marker.jpg`, `p08-night-fire.jpg`.

- `src/app/play/page.tsx`
  - Added `CARD_ART` mappings for the 8 Wave A cards.
  - Displays the card learning note in hand-card tooltips, a small card line (`學｜...`), and the quiz modal.

## Current Validation

- `npx eslint src/app/play/page.tsx` passes.
- `npx eslint src/data/cards.ts src/app/play/page.tsx` passes after the 8 Wave A card additions.
- `npx eslint src/data/cards.ts src/app/play/page.tsx` passes after adding `CARD_LEARNING`.
- All 8 Wave A card artworks are 384x480 JPG files.
- Browser spot-check: `http://localhost:3000/images/cards/l12-citrus.jpg` loads correctly from the running dev server.
- `npm run build` passes after the 8 Wave A card additions and art mappings.
- Full `npm run lint` may still fail because `/journey` has concurrent work in progress. Do not treat that as caused by `/play` unless the error references `src/app/play/page.tsx`.

## Known Visual Follow-Ups

- Desktop 1280x720: the hand is intentionally bottom-anchored and partially visible, similar to a card battle table. If the user wants full cards visible above the fold, reduce `.hs-combat-lane` height/margins or move `.hs-portrait-player` upward.
- Mobile 390x844: the core vertical flow is visible, but further tuning may be needed after Claude's concurrent UI work stabilizes.
- The battle log is now a small floating panel. If it competes with board readability, collapse it behind a small button.

## Do Not Overwrite

- Do not touch `src/app/journey/page.tsx` unless explicitly assigned. It has active concurrent work.
- Do not edit `.claude/` as part of this handoff.
- Do not replace existing `public/images/cards/*` assets with Hearthstone-like assets.
- Do not introduce copied Hearthstone art, card frames, icons, or branding.
- Do not add the remaining proposed cards until the user approves which candidates should enter `src/data/cards.ts`.
- Do not overwrite the 8 generated Wave A card artworks unless the user explicitly asks for replacement or a new art direction.
- Do not add any new playable card without a `CARD_LEARNING` note.

## Suggested Next Checklist

- Verify `/play` with a fresh local dev server after any merge.
- Confirm `.hs-table`, `.hs-opponent-hand`, and `.hs-resource-player` exist in the rendered DOM.
- Confirm the page outer shell uses `.play-page` and `.play-shell`; if these are missing, the board CSS will not fully apply.
- Test one card play flow: click playable card -> answer quiz -> continue -> target if needed -> board/log update.
- Test enemy turn once.
- Check desktop at 1280x720 and mobile at 390x844 before shipping.
- Review `CARD_EXPANSION_LEGEND_PROPOSAL.md` with the user before implementing the remaining proposed cards.
- Review the 8 generated Wave A card artworks in `/play` and replace only the specific images the user rejects.
- Review the wording of `CARD_LEARNING`, especially `彩虹當空`, `Pusu Qhuni 巨岩`, and `沉睡的馬威`, with cultural reviewers before public release.

# Mode B `/play` 爐石式對戰說明

> Date: 2026-07-10
> Status: working spec for implementation and handoff
> Scope: `/play` card battle mode only. Do not use this document to change `/journey`.

## 1. Project Brief

Mode B is a Truku language card battle. It borrows the readable table grammar of Hearthstone-like card games:

- Opponent area on top.
- Shared battle board in the middle.
- Player hero and hand at the bottom.
- Mana resources near the active player.
- Cards are played from hand, answered through a vocabulary quiz, then resolved as battle actions.

This is a layout and interaction reference only. The game must keep Enzo's mountain, river, forest, and Truku learning identity. Do not copy Hearthstone branding, art, icons, card frames, sounds, or exact UI ornaments.

## 2. Intended Players

- Primary: learners who want a game-like way to practice Truku vocabulary.
- Secondary: teachers, reviewers, and team members checking whether the learning loop is culturally safe and understandable.
- Internal users: Claude, Codex, and future AI agents continuing the project.

## 3. Success Criteria

The `/play` mode is successful when:

- A first-time player can identify opponent, board, player hero, hand, mana, and end-turn button within a few seconds.
- Playing a card naturally triggers a Truku vocabulary question.
- Correct answers feel rewarding through card bonuses, not detached from the battle.
- The board feels like a card battle table rather than a dashboard.
- The visual system is clearly Enzo/Truku-inspired and not a Hearthstone clone.
- Cultural red lines remain respected in card names, effects, art, and copy.

## 4. Gameplay Loop

1. The player starts with a hand of cards and a hero with health.
2. Each turn, the player receives mana crystals up to the current maximum.
3. The player chooses a playable card from the hand.
4. The game asks a vocabulary question linked to that card's `vocabId`.
5. If the player answers correctly, the card receives its bonus effect.
6. The card resolves:
   - Minions enter the player's board lane.
   - Spells resolve immediately.
   - Targeted spells wait for the player to choose a valid target.
7. Minions that can act may attack enemy minions or the enemy hero.
8. The player ends the turn.
9. The enemy automatically plays and attacks.
10. The match ends when either hero reaches 0 health.

## 5. Card Reading Order

Every card should communicate in this order:

1. Cost: how much mana is needed.
2. Name: the Chinese card name.
3. Theme: legend, nature, animal, plant, or tool.
4. Vocab: the Truku word tested by the quiz.
5. Learning note: what this card teaches about a legend, mountain ecology, travel, object, or cultural safety boundary.
6. Effect: what the card does normally.
7. Bonus: what improves when the player answers correctly.
8. Attack / health: only for minions.

## 6. Current Board Layout

The current `/play` screen should contain these zones:

- `.hs-opponent-hand`: opponent card backs at the top.
- `.hs-portrait-enemy`: enemy hero portrait and HP.
- `.hs-resource-enemy`: enemy mana display.
- `.hs-combat-lane`: shared board area with enemy and player minion rows.
- `.hs-portrait-player`: player hero portrait and HP.
- `.hs-resource-player`: player mana display.
- `.hs-hand-zone`: bottom player hand.
- `.play-log-panel`: compact battle log.

If these zones disappear after a merge, the page will drift back toward a generic panel layout.

## 7. Visual Direction

Use:

- Warm carved-board surfaces, river-blue accents, amber highlights, forest green, slate stone, and night-sky contrast.
- Card backs and frames that feel hand-crafted and mountain/river themed.
- Clear mana crystals or tokens, but with Enzo styling.
- Hero portraits that read as symbolic roles, not literal sacred figures.

Avoid:

- Direct Hearthstone frame copying.
- Purple-blue fantasy gradients as the dominant look.
- Overly rounded dashboard cards.
- Sacred or restricted cultural symbols used as casual game ornaments.
- Decorative clutter that makes the board hard to scan.

## 8. Cultural Safety Rules

The current card set intentionally removed earlier unsafe directions such as `Utux`, headhunting, hundred-pace snake motifs, stereotyped people cards, and fictional spirits.

For this mode:

- Prefer environment, object, trace, journey, weather, animal, and plant cards.
- Treat rainbow bridge imagery as a sensitive cultural image, not as a full ritual or judgment system.
- Do not turn ancestors, sacred spirits, or ritual authority into playable units or game mechanics.
- Do not use `gaya`, `Utux`, judgment, headhunting, tattooing, or afterlife rules as power keywords.
- Any new legend-based card should cite the local source file:
  `/Users/calumai/Documents/card/enzo-culture/references/truku-legends-sourced.md`
- Every playable card must have a `CARD_LEARNING` entry in `src/data/cards.ts`, so players learn one concrete idea from seeing or playing the card.

## 9. Review Checklist

Before shipping `/play`, check:

- Desktop 1280x720: opponent, board, player hero, and bottom hand are all readable.
- Mobile 390x844: the player can still play a card and end turn without layout overlap.
- Card play flow: click card, answer quiz, resolve bonus, see log update.
- Target flow: targeted spell waits for a selected target.
- Enemy turn: enemy plays and attacks without freezing the match.
- Win/loss: match result appears clearly.
- Build: `npm run build` passes.
- Focused lint: `npx eslint src/app/play/page.tsx` passes.

## 10. Handoff Notes

- Do not edit `src/app/journey/page.tsx` unless explicitly assigned; it has concurrent Claude work.
- Do not edit `.claude/` as part of `/play` work.
- When adding cards, update both the card data and the card art plan.
- When adding cards, also add a `CARD_LEARNING` note; the build fails if a card is missing one.
- If a new card effect requires engine logic, document the effect ID before adding it to `src/data/cards.ts`.

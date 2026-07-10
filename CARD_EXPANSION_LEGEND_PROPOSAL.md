# Card Expansion Proposal: Truku Legend-Safe Additions

> Date: 2026-07-10
> Status: Wave A first 8 cards implemented in `src/data/cards.ts` with card art; remaining cards are proposal only
> Current deck count: 40 main cards + 1 token
> Suggested next target: 48 main cards + tokens

## 1. Why Expand

The current card pool is playable but still small for a Hearthstone-style mode. A 32-card pool quickly repeats names, effects, quiz prompts, and visuals. The next milestone should add 16 cards, bringing the main card count to 48.

The expansion should not simply add stronger cards. It should widen the feeling of the world:

- more journey objects,
- more weather and terrain,
- more legend-adjacent imagery,
- more low-cost cards so early turns feel active,
- more culturally safe cards that do not turn sacred material into mechanics.

## 2. Source Boundary

Use the local approved reference file as the starting point:

`/Users/calumai/Documents/card/enzo-culture/references/truku-legends-sourced.md`

Approved story pool in that file:

- Shooting the Sun
- Pusu Qhuni stone/tree origin
- Great Flood
- Mawi the Giant
- Rainbow Bridge Hakaw Utux, imagery only

## 3. Cultural Design Rules

Use these card-design rules before adding anything to `src/data/cards.ts`:

- Prefer places, traces, tools, weather, plants, animals, and journey supplies.
- Avoid making ancestors, sacred spirits, or ritual authority into playable units.
- Do not use `Utux`, ancestor judgment, headhunting, tattooing, or afterlife punishment as effects.
- Rainbow bridge content should stay at the level of image, distance, crossing, return, memory, or light.
- Mawi content should favor footprints, terrain, far-sea islands, and story aftermath instead of making more giant-character units.
- Any new Truku word must be verified through `vocab()` and `src/data/truku-vocab.json`.

## 4. Recommended Expansion Shape

Add 16 cards in two waves:

- Wave A: 8 lower-risk prototype cards using environment, travel, weather, and objects. Implemented 2026-07-10.
- Wave B: 6 legend-adjacent cards requiring cultural review before final naming/art.
- Hold list: 2 additional lower-risk cards can be selected after play balance and art needs are clearer.

This lets the game feel fuller quickly while leaving sensitive cards in a reviewable lane.

## 5. Wave A: Safer Prototype Cards

| Proposed name | Theme | Type | Cost | Vocab candidate | Effect concept | Source link | Review |
|---|---:|---:|---:|---|---|---|---|
| 遠行的柑橘 | legend | minion | 1 | `08-08` 柑橘 | 1/2. Battlecry: draw 1 | Shooting the Sun, planted food on long journey | Implemented |
| 接力的道路 | legend | spell | 2 | `10-01` 道路 | Draw 1; correct answer draws 2 | Shooting the Sun, generational relay | Implemented |
| 休息的夜 | nature | spell | 2 | `13-22` 夜 | Give friendly minions stealth this turn | After the two-sun crisis, night returns | Implemented |
| 風停後的路 | tool | spell | 2 | `11-31` 雨停 | Give a friendly minion +1/+1; correct answer grants charge | Journey repair image | Implemented |
| 溪畔補給 | nature | minion | 2 | `10-03` 小溪 | 1/3. End of turn: heal hero 1 | Travel and river crossing | Implemented |
| 山口逆風 | nature | spell | 3 | `10-04` 風 | Return one enemy minion to deck; correct answer draws 1 | Weather as obstacle | Implemented |
| 退水河床 | nature | spell | 3 | `11-31` 雨停 | Deal 2 to all damaged minions | Great Flood aftermath, non-ritual | Green-yellow |
| 石堆路標 | tool | minion | 3 | `12-11` 石堆 | 1/5 taunt | Mountain route marker | Implemented |
| 火光守夜 | tool | spell | 3 | `30-33` 光明 | Heal hero 5 | Camp and safety image | Implemented |
| 樹根護徑 | plant | minion | 4 | `08-28` 根 | 2/6 taunt | Pusu Qhuni-adjacent tree imagery | Green-yellow |

## 6. Wave B: Needs Cultural Review

| Proposed name | Theme | Type | Cost | Vocab candidate | Effect concept | Source link | Review |
|---|---:|---:|---:|---|---|---|---|
| 樹頭的記憶 | legend/plant | spell | 4 | `08-25` 樹頭 | Summon two saplings | Pusu Qhuni; origin image only | Yellow |
| 石木根脈 | legend/plant | minion | 5 | `08-28` 根 | 2/8 taunt | Pusu Qhuni; avoid dramatizing origin birth | Yellow |
| 水退後的星光 | legend/nature | spell | 4 | `11-05` 星星 | Draw 2; correct answer heals 3 | Great Flood star image | Yellow |
| 遠海兩島 | legend/nature | spell | 5 | `11-26` 海邊 | Deal 3 to enemy minions | Mawi aftermath, no playable giant | Yellow |
| 彩虹橋影 | legend/nature | spell | 5 | `12-07` 橋樑 | Restore 8 health | Rainbow bridge as distant image only | High-yellow |
| 虹光歸路 | legend/nature | spell | 6 | `11-28` 彩虹 | Restore 8 health and draw 1 on correct answer | Rainbow as return/connection image only | High-yellow |

## 7. Cards To Avoid

Do not add cards based on:

- `Utux` as a keyword, unit, judge, boss, resource, or playable card.
- Head-taking, hunting trophies, tattooing, or afterlife punishment.
- Fictional spirits invented for combat.
- Generic "tribal warrior" people cards.
- Hundred-pace snake motifs; this was already removed as a red-line direction.
- More playable legend characters until the existing `沉睡的馬威` card has been reviewed.

## 8. Implementation Checklist

When the team approves specific cards:

1. Add only approved cards to `src/data/cards.ts`.
2. Keep ids sequential, for example `leg-l12`, `leg-n08`, `leg-p06`.
3. Use only vocabulary ids that pass `vocab()`.
4. Prefer existing effect ids first so the engine does not expand too fast.
5. If a new effect is truly needed, document the effect id before coding it.
6. Add or generate matching art under `public/images/cards/`.
7. Verify `/play` with one full card-play flow.
8. Update `PLAY_HEARTHSTONE_MODE.md` and this proposal after implementation.

## 9. Recommendation

First 8 cards implemented with card art:

- 遠行的柑橘
- 接力的道路
- 休息的夜
- 風停後的路
- 溪畔補給
- 山口逆風
- 石堆路標
- 火光守夜

They are useful for gameplay, use available vocabulary, and stay safely away from sacred or restricted material. The next recommended choices are `退水河床` and `樹根護徑`, but both should wait until the team decides whether the next work is card art, engine balance, or cultural review.

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

## 2026-07-11 Codex Size Pass

User feedback: the battle board still felt too small compared with Hearthstone. This pass intentionally makes the desktop `/play` board read as a large card-battle table instead of a compact dashboard panel.

Changed:

- `src/app/play/page.tsx`
  - Reduced outer page padding from `p-3 sm:p-5` to `p-2 sm:p-4`.
  - Enlarged board minion tokens from `w-[72px]` to `w-[86px] md:w-[102px]`.
  - Enlarged player hand cards from `w-[112px] sm:w-[132px]` to `w-[132px] md:w-[164px] xl:w-[178px]`.

- `src/app/globals.css`
  - Expanded `.play-shell` from `1240px` to `1560px`.
  - Increased `.hs-table` viewport usage, top/bottom padding, and combat lane height.
  - Enlarged opponent card backs, hero portraits, HP pill, mana strip spacing, board row minimum height, and bottom hand rail.
  - Moved player portrait/resource strip upward to stay above the larger hand.
  - Pulled `.hs-hand-zone` upward on desktop/tablet so the enlarged hand still peeks into a 1280x720 first viewport.
  - Added tablet/mobile overrides so the larger desktop sizing does not dominate narrow screens.

Intent:

- Desktop should now feel much closer to a full-screen board.
- Hand cards should be inspectable without feeling like thumbnails.
- Field minions should be large enough that their art and attack/health gems are readable.
- Mobile should remain usable, even if desktop is the main target for this size pass.

## Known Visual Follow-Ups

## 2026-07-11 Codex Battle Table Rebalance

User screenshot feedback: the board was too dark, the two empty lanes looked like oversized UI panels, and the hand was compressed into a small strip at the bottom.

This pass changed only the `/play` presentation layer:

- `src/app/play/page.tsx`
  - Enlarged hand cards to `132px / 164px / 178px` responsive widths.

- `src/app/globals.css`
  - Made the battle table fit the first desktop viewport with `height: calc(100vh - 90px)`.
  - Reduced the dark table overlay so the board art and card art remain readable.
  - Replaced the oversized capsule feeling of the two board rows with flatter, wider battle zones.
  - Centered the hand at the bottom of the table and restored a single source of horizontal centering (the old transform was otherwise applied twice).
  - Kept the player hero and mana strip above the hand, with the end-turn control on the right edge of the battlefield.
  - Mobile resets the fixed table height and returns the hand to normal document flow.

Validation:

- `npx eslint src/app/play/page.tsx` passes with the existing three warnings only.
- Local visual check at `1280x720` confirms the table, hand, hero and end-turn control are all visible in the first viewport.
- No engine, quiz, card data, sound, or combat-event logic was changed in this pass.

Follow-up for the animation pass: keep these zones as the stable layout anchors, then layer card flight, attack lunge, impact, damage, death, and turn-transition events above them.

- Desktop 1280x720: after the 2026-07-11 size pass, the hand is larger and horizontally scrollable. If it crowds the board too much, reduce only the hand width first (`w-[132px] md:w-[164px] xl:w-[178px]`) before shrinking the whole table.
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

---

## 2026-07-12 · 事件驅動戰鬥系統（ORDER-070）

把 `/play` 從「直接 setGame + 前後盤面 diff 推導特效」改成**引擎產生事件、畫面逐一播放**的架構。之前也已補上難度分級、配樂、mulligan/認輸/連勝、新手引導、多套對手（見 git log ORDER-064~069）。

### 事件系統（engine 產生，view 播放 — 邏輯與視覺分離）

- **型別**（`src/engine/types.ts`）：`CombatEvent` discriminated union + `EventStep = { event, state }`（每個事件附「發生後的權威盤面快照」）。事件類型：
  `TURN_START / MANA_REFRESH / DRAW / CARD_PLAY / SUMMON / SPELL / ATTACK_WINDUP / ATTACK_LUNGE / IMPACT / DAMAGE / HEAL / DEATH / TURN_END`。
- **產生器**（`src/engine/game.ts` 尾段）：`playCardFlow / attackFlow / startTurnFlow / endTurnFlow / enemyTurnFlow` 各回傳有序 `EventStep[]`。它們**複用既有純 reducer**（`playMinionFor`/`castSpell`/`resolveAttack`/…），並用 `deriveHits(before, after)` 在**每個子動作**後推導 DAMAGE/HEAL/DEATH/SUMMON（是引擎內的逐步推導，不是畫面拿兩張整回合快照亂猜）。
- `runEnemyTurn` 現在 = `applyLast(enemyTurnFlow(...))`，AI 只有一份實作；`scripts/sim-ai.mts` 驗證難度勝率仍為 easy≈17% / normal≈47% / hard≈84%。

### 播放器（`src/app/play/useCombat.ts`）

- 擁有「顯示用 `game`」、`locked`（輸入鎖）、與全部動畫狀態。`play(steps)` 依序播放，播放期間 `locked=true`，所有輸入 handler 都 `if (locked) return`。
- 每種事件的時間軸（見 `D` 常數）：卡牌上浮施放 → 隨從彈入 → 攻擊蓄力(windup)→突進(lunge，用 `getBoundingClientRect` 量攻擊者與目標算 transform)→命中閃光(impact)→傷害跳字 → 死亡殘影（先停頓再淡出化光；在移除前 `snapshotRects()` 記位置，避免瞬間消失）→ 法術色幕 → 回合橫幅 / 法力・抽牌脈動。
- `registerEl(anchor)` callback ref 收集隨從/英雄 DOM，供突進位移與死亡殘影定位。

### 動畫 CSS（`src/app/globals.css` 尾段「事件驅動戰鬥動畫時間軸」）

`hs-windup / hs-impact / dmg-float(-heal) / combat-banner / combat-cast / spell-veil + spell-{damage,aoe,heal,summon,draw,buff} / death-ghost / mana-pulse / draw-pulse`，以及答題面板 `combat-quiz-*`、手牌 hover 放大。**全部在 `@media (prefers-reduced-motion: reduce)` 關閉**；播放器也把等待時間夾到 ~24ms 並跳過位移/殘影，reduced-motion 下仍可正常遊玩。

### 答題（保留族語學習）

答題視窗改成戰場流程的一部分：半透明背板（保留戰場可見）+ 琥珀框 + 「出牌考驗」抬頭 + 淡入，不再像跳出另一個網站視窗。族語題庫、發音、卡片學習小註都保留。

### 驗收結果（瀏覽器實測）

- ✅ 一眼分辨敵我/戰場/手牌/法力（敵上、我下、手牌貼底、法力靠我方、結束回合靠右）。
- ✅ 出牌、攻擊、命中、死亡、抽牌、回合切換都有明顯但不拖沓動畫；實測：出牌→答題→召喚、隨從互毆雙死、整個敵方回合在鎖定下逐步播放、回合 2 法力/抽牌。
- ✅ 連續操作不會重複/重播/錯亂：`locked` 播放期間擋所有輸入，事件序列一次算好再播。
- ✅ 桌面 1280×720：戰場為第一視覺焦點（scrollY=0 全盤面可見）。
- ✅ `prefers-reduced-motion`：程式與 CSS 皆處理（時間夾短、跳過位移/殘影）。
- ⚠️ 手機 375px：已修掉「音樂鈕蓋住結束回合」（音訊鈕改到左下、桌面維持右下）。**但底部（手牌/我方英雄/結束回合/重新開始）仍偏擠**——這是既有 desktop-first 版面的限制，非本次事件系統造成。**後續待辦**：做一版手機專屬底部佈局。

### 後續待辦

- 手機版底部佈局重排（hero/hand/控制鈕分層，避免擠壓）。
- 出牌「飛入」目前用中央施放示意，尚未做「從手牌該張精準飛到戰場落點」；要更精準需量手牌卡 rect → 戰場落點做 FLIP。
- 頭目專屬立繪（走 Artemis→Codex→enzo-culture 管線）。
- 攻擊突進在極端排版下 transform 由 rect 計算，若日後改版面需重測。

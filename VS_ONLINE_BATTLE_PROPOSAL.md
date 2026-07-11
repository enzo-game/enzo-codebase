# ORDER-060 — 線上連線對戰 技術方案（PvP）

> 目標：讓兩位玩家能在 `/play` **線上即時對戰**（爐石式回合制 + Truku 答題出牌），
> 建立在現有 Vercel serverless 架構上，並順帶把 CLAUDE.md 待決的「遊戲雲端 DB」一併定案。

---

## 0. 現況與核心難點

| 現況 | 問題 |
|---|---|
| 整個對戰 reducer（`src/app/play/page.tsx`）跑在 **瀏覽器** | PvP 下前端可竄改血量、法力、答題結果 |
| `Game` 物件同時持有 `eHand` / `eDeck` 完整內容 | 對手手牌、牌庫底整份都在 client → 可看穿 |
| 洗牌用前端亂數 | 客戶端可預測/操縱抽牌 |
| Vercel serverless **沒有常駐 process** | 無法自架長連線 WebSocket server |

結論：不是「加個 socket」就好，必須改成 **伺服器權威（server-authoritative）** 架構。

---

## 1. 建議架構（Recommended）

**單一推薦：Supabase（Postgres + Realtime + Edge Functions）一套解決。**

理由：同時補齊 CLAUDE.md 待選的「玩家進度 / 對戰紀錄 / 收藏」雲端 DB，又內建即時同步，一個服務兩件事，維運面最小。

```
 玩家 A (Next.js/Vercel)                          玩家 B
        │  ① action(意圖: 出牌/答題/攻擊/結束回合)      │
        ▼                                              ▼
   Supabase Edge Function  ── play_action(matchId, action, answer)
        │  ② 伺服器端重算 reducer + 驗證合法性/答題
        ▼
   Postgres  matches 表（權威狀態，含隱藏資訊）
        │  ③ 寫入後，Realtime 推送「去敏化」狀態
        ▼
   兩端各自收到自己視角的 state（對手手牌只給張數）
```

- **即時傳輸**：Supabase Realtime（Postgres Changes 或 Broadcast）。
- **權威計算**：Edge Function（Deno，原生跑 TypeScript）→ 現有 reducer 可**直接複用**移植成純函式。
- **隱藏資訊**：對手的手牌內容、牌庫順序只存 DB，推給前端時**去敏化**成張數。
- **亂數**：洗牌 / 抽牌的 seed 由伺服器持有，client 無法預測。

### 替代方案（若不用 Supabase）
| 方案 | 即時 | DB | 取捨 |
|---|---|---|---|
| **Ably / Pusher** + Vercel Postgres | 專業即時、低延遲 | 另接 DB | 兩個服務、成本較高 |
| **Vercel + 純輪詢(polling)** | 每 1–2s 拉一次 | Vercel Postgres | 最省，但體感較鈍、不適合節奏快的對戰 |
| 自架 WebSocket（Railway/Fly.io） | 最靈活 | 自理 | 脫離 Vercel，維運成本最高 |

> 若你已有 Supabase 帳號或偏好，直接走推薦方案；否則我可先做 polling 版驗證流程再升級。

---

## 2. 資料模型（Postgres 草案）

```sql
-- 對局
matches (
  id uuid pk,
  status text,            -- waiting | active | finished
  room_code text unique,  -- 好友房 6 碼；隨機配對為 null
  player_a uuid, player_b uuid,
  state jsonb,            -- 權威 Game 狀態（含雙方手牌/牌庫/seed）
  turn_owner uuid,        -- 現在輪到誰
  turn_deadline timestamptz,  -- 回合逾時
  winner uuid,
  created_at, updated_at
)

-- 動作紀錄（除錯 / 防作弊稽核 / 重播）
match_events ( id, match_id, actor uuid, action jsonb, created_at )

-- 玩家（順便定案：進度/收藏也放這）
profiles ( id uuid pk, display_name, wins, losses, created_at )
```

RLS（Row Level Security）：玩家只能讀自己參與的 match，且**永遠讀不到 `state` 原始欄位**——一律透過 Edge Function / View 回傳去敏化視角。

---

## 3. 反作弊清單（必做，不可略）

1. **答題結果伺服器驗**：出牌需附答案，正確與否由 Edge Function 對照 `truku` 資料判定，不信前端 `correct/wrong`。
2. **動作合法性驗**：法力夠不夠、卡在不在手牌、攻擊目標是否合法、是不是你的回合 → 全部伺服器重算。
3. **隱藏資訊去敏化**：對手手牌/牌庫只回張數；偷看=拿不到資料。
4. **伺服器持有 RNG seed**：洗牌抽牌不可被客戶端預測。
5. **回合逾時**：`turn_deadline` 到自動結束回合，防拖延/掛機。

---

## 4. 分階段落地（建議順序）

| 階段 | 內容 | 產出 |
|---|---|---|
| **P0 引擎抽離** | 把 `page.tsx` 的 reducer 抽成純函式模組 `src/engine/`（無 React、可單測、Edge Function 共用） | 前置，必做 |
| **P1 配對** | 建房（6 碼）/ 加入房；`matches` 表 + Realtime 訂閱 | 好友對戰可連上 |
| **P2 權威對戰** | Edge Function `play_action` + 去敏化狀態推送；前端改為「送意圖、收狀態」 | 兩人能完整打完一局 |
| **P3 韌性** | 斷線重連（憑 matchId 復原）、回合計時、投降、隨機配對佇列 | 可上線體驗 |
| **P4 留存** | `profiles` 勝負紀錄、收藏/進度持久化、簡易天梯 | 長期營運 |

MVP 建議先做 **P0→P2 的好友房**（輸入房號對戰），最快能讓兩個人真的連上互打；隨機配對與天梯放 P3/P4。

---

## 5. 需要你拍板的三件事

1. **即時服務**：走推薦的 **Supabase**？（同時定案雲端 DB）還是先做 polling 驗證版？
2. **MVP 範圍**：先只做**好友房（房號對戰）**，還是一次要含**隨機配對**？
3. **帳號**：對戰要不要先登入？可先用**匿名 session**（不擋玩家），profiles 之後補。

---

## 6. 風險與備註

- Edge Function 冷啟動延遲：回合制可接受（非即時動作遊戲）。
- 現有 `Game` 型別要拆成「權威完整態」與「玩家視角去敏態」兩份 —— 這是 P0/P2 的主要重構量。
- 文化素材（卡牌傳說/詞彙）不受此工程影響，維持既有 guardrail。
- 成本：Supabase 免費層足夠 MVP 驗證。

---

## 7. P2 實作註記（2026-07-11，架構微調）

**權威計算改放 Vercel Route Handler，不用 Supabase Edge Function。** 兩者對「伺服器權威」等價，
但 Route Handler 走既有 Vercel 部署管線（不需 Docker / `supabase login`）、且能直接 import 現有
TS 引擎（不必移植到 Deno），更貼合 CLAUDE.md「前後端全 Vercel」。Supabase 僅負責 DB＋Realtime＋匿名 Auth。

資料流：
```
玩家送意圖 → POST /api/match/action（service role，跑 src/engine/match.ts 權威 reducer）
          → 寫 match_state.state（完整態，RLS deny-all，client 讀不到）
          → bump matches.version → Realtime 推 matches 列（只有 version 等公開欄位，無機密）
兩端收到 poke → GET /api/match/view → 伺服器回「自己座位的脱敏視角」（對手手牌/牌庫只給張數）
```

反作弊全數落實：答題對錯伺服器判、動作合法性伺服器重算、隱藏資訊只存 match_state、洗牌 seed 在伺服器。
產出：`src/engine/match.ts`、`src/lib/matchServer.ts`、`src/app/api/match/{action,view}/route.ts`、
`src/app/vs/[id]/page.tsx`、`supabase/migrations/0002_match_play.sql`、`scripts/sim-vs.mts`（無頭驗證）。

**上線前置（只差這步）**：接上 Supabase 專案 —— `.env.local` 與 Vercel 填三把金鑰、開 Anonymous
Sign-ins、套 `supabase/migrations`（0001+0002）。之後兩個瀏覽器即可完整對打。

# enzo-codebase - Enzo 遊戲實際代碼庫

這是 Enzo（Truku 爐石式卡牌遊戲）唯一的實際程式碼 repo，main branch 受保護。

**目標遊戲**：爐石式卡牌 + Truku 詞彙答題機制
**MVP 範圍**：30 張卡、105 個 Truku 詞彙、2026 年內上線

**技術棧（2026-07-07 定案）**：
- 前端 + 後端：全部部署在 **Vercel**（serverless）
- 詞彙資料：從 `hunter.db`（正式站 `/var/www/hunter/backend/hunter.db`，唯讀，~1,092 詞）匯出成靜態 JSON，隨專案一起部署，不即時連線 droplet
- 遊戲本身資料（玩家進度、對戰紀錄、卡牌收藏）：待 enzo-deployment 選定雲端資料庫方案（Vercel Postgres / Turso / Supabase）
- 部署流程：GitHub push to main → Vercel 自動部署

**參與部門**：
- 設計依據 `enzo-game-design` 的卡牌與題庫定義
- 前端邏輯由 `enzo-frontend` (Hermes) 負責架構
- 美術資源由 `enzo-art` (Artemis) 提供
- 詞彙 JSON 由 `enzo-language-truku` (Mnemosyne) 提供並維護
- QA (`enzo-qa`) 與 Deployment (`enzo-deployment`) 負責上線前把關

**分支規則**：main branch 保護，功能開發走 feature branch + PR。

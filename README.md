# enzo-codebase

Enzo 實際遊戲代碼庫（protected main branch）。技術棧：Next.js（TypeScript + Tailwind + App Router），前端與 API routes 皆部署於 Vercel serverless。

## 結構
- `CLAUDE.md` - 本部門的系統提示 / 身份證
- `orders/` - 派令板（todo.md / doing.md / done.md）
- `harbor/reports/` - 上級收件港（週報存放處）
- `src/app/` - Next.js App Router 頁面與 API routes
- `src/app/api/health/route.ts` - 健康檢查 API，確認 serverless function 正常運作

## 本機開發

```bash
npm install
npm run dev
```

打開 http://localhost:3000 看首頁，http://localhost:3000/api/health 看健康檢查 API。

## 部署

Push 到 `main` 會自動觸發 Vercel 部署（GitHub → Vercel 整合）。

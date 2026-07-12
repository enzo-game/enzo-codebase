# Claude Handoff: 天梯排行榜視覺重製

日期：2026-07-13
範圍：`/vs/leaderboard`
目標：把目前的黑底窄列表，改成「山林天梯大廳」。這是一個排行榜大廳，不是 `/play` 戰鬥桌面。

## 參考圖片

- 完整構圖示意：[leaderboard-concept.jpg](public/images/vs/leaderboard/leaderboard-concept.jpg)
- 可作為 CSS 背景：[leaderboard-bg.jpg](public/images/vs/leaderboard/leaderboard-bg.jpg)

`leaderboard-concept.jpg` 只用來對照版面比例與層級，不要直接當頁面背景，也不要使用圖片裡的玩家文字、數字或按鈕。所有資料必須由 React 真實渲染。

## 視覺目標

頁面應該像「通往山巔的排行榜石碑」：夜山、溪流、木架、石碑、營火，中央資料區清楚可讀。

不要做成：

- 純黑背景的管理後台
- 戰鬥場景本身
- 一張把文字和數字都畫死的圖片
- 過多浮動卡片或大型裝飾

## 元件結構

```text
LeaderboardPage
├─ LeaderboardBackdrop
│  ├─ leaderboard-bg.jpg
│  └─ readable overlay
├─ SummitHeader
│  ├─ SummitEmblem
│  ├─ h1 天梯
│  └─ subtitle 勝場排行 · 群峰之巔
├─ Podium
│  ├─ PodiumCard place=2
│  ├─ PodiumCard place=1
│  └─ PodiumCard place=3
├─ RankingTable
│  └─ RankingRow rank=4...
└─ BackToLobby
```

## HTML / JSX 目標結構

保留目前 `fetchLeaderboard()`、`myProfile()`、`Profile`、勝率計算與錯誤／載入／空狀態邏輯，只重排外層 class：

```tsx
<main className="lb-page">
  <img className="lb-bg" src="/images/vs/leaderboard/leaderboard-bg.jpg" alt="" aria-hidden />
  <div className="lb-scrim" aria-hidden />

  <div className="lb-shell">
    <header className="lb-header">
      <SummitIcon className="lb-summit-icon" />
      <h1>天梯</h1>
      <p>勝場排行 · 群峰之巔</p>
    </header>

    <section className="lb-podium" aria-label="前三名">
      <PodiumCard place={2} ... />
      <PodiumCard place={1} ... />
      <PodiumCard place={3} ... />
    </section>

    <section className="lb-ranking" aria-label="排行榜">
      <div className="lb-ranking-head">
        <span>名次</span><span>玩家</span><span>勝率</span><span>勝場</span><span>敗場</span>
      </div>
      {rest.map(...)}
    </section>

    <Link className="lb-back" href="/vs">← 回到大廳</Link>
  </div>
</main>
```

不要在 JSX 裡寫死前三名或玩家名稱；沿用目前 `podium`、`rest` 和 `myName` 資料。

## CSS 方向

```css
.lb-page {
  position: relative;
  min-height: 100svh;
  overflow: hidden;
  color: #f5e6c5;
  background: #08110f;
}

.lb-bg,
.lb-scrim {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.lb-bg {
  object-fit: cover;
  object-position: center;
  opacity: .9;
}

.lb-scrim {
  background: linear-gradient(180deg, rgba(3, 8, 10, .34), rgba(3, 8, 10, .72));
}

.lb-shell {
  position: relative;
  z-index: 1;
  width: min(1120px, calc(100% - 48px));
  margin: 0 auto;
  padding: 56px 0 32px;
}

.lb-header {
  margin-bottom: 30px;
  text-align: center;
}

.lb-podium {
  display: grid;
  grid-template-columns: 1fr 1.15fr 1fr;
  align-items: end;
  gap: 16px;
  margin-bottom: 20px;
}

.lb-ranking {
  overflow: hidden;
  border: 1px solid rgba(226, 164, 58, .38);
  border-radius: 12px;
  background: rgba(11, 20, 19, .84);
  box-shadow: 0 18px 50px rgba(0, 0, 0, .38), inset 0 1px rgba(255,255,255,.06);
  backdrop-filter: blur(8px);
}

.lb-ranking-head,
.lb-row {
  display: grid;
  grid-template-columns: 80px minmax(160px, 1fr) minmax(150px, 1fr) 90px 90px;
  align-items: center;
  gap: 14px;
}

.lb-ranking-head {
  padding: 11px 18px;
  color: rgba(245, 230, 197, .55);
  font-size: 11px;
  letter-spacing: .12em;
  text-transform: uppercase;
  background: rgba(4, 10, 12, .5);
}

.lb-row {
  min-height: 58px;
  padding: 10px 18px;
  border-top: 1px solid rgba(245, 230, 197, .1);
}

.lb-row.is-me {
  background: rgba(45, 96, 66, .3);
  box-shadow: inset 3px 0 #8bcf76;
}

@media (max-width: 700px) {
  .lb-shell { width: min(100% - 24px, 520px); padding-top: 28px; }
  .lb-podium { gap: 6px; }
  .lb-ranking-head { display: none; }
  .lb-row { grid-template-columns: 42px minmax(0, 1fr) auto; gap: 8px; }
  .lb-row .lb-rate { grid-column: 2 / 4; }
  .lb-row .lb-record { display: block; }
}
```

卡片圓角維持 12px 以下；用石板邊框、木色陰影和低透明度玻璃層，不要回到純黑大面積。

## 元件內容規則

- 第 1 名：最高領獎台、琥珀金、皇冠或山峰徽章。
- 第 2 名：左側、銀灰石材。
- 第 3 名：右側、銅橙石材。
- 第 4 名以後：列表顯示名次、名稱、勝率條、勝場、敗場。
- `myName` 對應的玩家列使用綠色高亮，但不可只靠顏色，保留「你」文字。
- 沒有資料時保留山巔空狀態，不要變成空白黑頁。
- API 錯誤與載入狀態仍要在同一個石碑內容區顯示。

## 驗收清單

1. 桌面版不再出現大片純黑背景。
2. 前三名形成明確的 2-1-3 領獎台。
3. 第 4 名以後的列表寬度足夠，勝率條清楚可讀。
4. 背景圖沒有承載真實玩家資料，數字全部來自 React。
5. 手機版不會橫向溢出，排行榜仍能快速掃讀。
6. `npm run build` 通過。
7. 不要修改 `.claude/`，不要覆蓋 Claude 其他未提交檔案。

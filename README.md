# Spotify Premium Family 訂閱分攤管理系統

用於協助管理者管理 Spotify Premium Family 成員、帳期、費用分攤與付款紀錄的單人管理工具。

目前專案處於需求與架構規劃階段，尚未建立 React 專案、資料庫或任何功能程式碼。

## 第一階段範圍

- 僅供一位管理者使用。
- 僅管理 Spotify Premium Family。
- 支援訂閱狀態儀表板、成員管理、月繳與年繳設定、帳期與費用分攤、付款狀態與付款紀錄、統計資料及歷史紀錄。
- 付款由管理者手動登記，不串接金流。
- 前端規劃採 React、TypeScript 與 Vite。
- 規劃部署至 GitHub Pages。
- 身分驗證與資料儲存規劃採 Supabase Auth、Supabase PostgreSQL，並以 Row Level Security 控制存取。
- 資料模型需保留未來擴充其他訂閱服務的可能性，但第一階段不實作其他服務。

## 文件導覽

- [需求規格](docs/requirements.md)：定義目標、範圍、使用情境與驗收方向。
- [業務規則](docs/business-rules.md)：定義費用、帳期、付款及歷史資料等規則，並列出待確認事項。
- [系統架構](docs/architecture.md)：記錄技術選型、系統邊界、概念資料模型與安全原則。
- [專案進度](docs/progress.md)：追蹤已完成、待確認與後續工作。

## 目前狀態

第一階段的初版需求文件已建立。開始實作前，應先確認 `docs/business-rules.md` 中的待確認事項，再據此完成資料庫設計與畫面規格。

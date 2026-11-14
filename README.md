# 我的網站開發展示（伺服器端密碼驗證版）

- **公開首頁**：展示公開網站專案（目前收錄「台灣中古車實價趨勢與世代資料庫」）。
- **私人入口**：密碼與私人網站清單完全存放在**伺服器端環境變數**，不會出現在前端 HTML、JS 或 Git 倉庫中。

## 檔案結構

- `server.js`：零相依套件的 Node.js 伺服器（提供首頁與 `POST /api/unlock` 驗證 API）
- `public/index.html`：前端展示頁面（不含任何私人網址或密碼）
- `package.json`：定義啟動指令 `npm start`
- `.env`：本機測試用環境變數（**已透過 `.gitignore` 排除，絕對不會被推上 Git**）
- `.env.example`：環境變數範例檔

---

## 本機啟動測試

```bash
node server.js
```

啟動後打開瀏覽器前往 `http://localhost:3000`。

---

## 部署到線上（Render）

因為 GitHub Pages 僅支援純靜態網頁、無法執行伺服器端密碼驗證，建議將此專案推送到 GitHub 後，直接部署到 **Render**（與你的 `onrender.com` 服務相同）：

1. 將此專案推送到 GitHub（`.env` 不會被上傳）。
2. 到 [Render](https://render.com/) 建立 **New Web Service**，連結你的 GitHub Repository。
3. 設定：
   - **Runtime**：`Node`
   - **Build Command**：留空（本專案無需安裝額外套件）
   - **Start Command**：`node server.js`
4. 在 Render 的 **Environment** 分頁新增兩個環境變數：
   - `PRIVATE_PASSWORD`：你的私人入口密碼
   - `PRIVATE_SITES_JSON`：私人網站 JSON 陣列，例如：
     ```json
     [{"name":"Web3 Airdrop Dashboard","url":"https://your-private-site.example.com/","description":"私人未公開儀表板","tag":"Private"}]
     ```
5. 點擊 **Deploy** 即可完成上線。

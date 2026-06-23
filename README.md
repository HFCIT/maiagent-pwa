# MaiAgent 智能客服 PWA

把 [MaiAgent](https://chat.maiagent.ai) 對話視窗包成一個可安裝的漸進式網頁應用程式（PWA），透過 iframe 全螢幕內嵌。

## 內容

| 檔案 | 用途 |
| --- | --- |
| `index.html` | 全螢幕內嵌 iframe + Service Worker 註冊 + 載入動畫/備援 |
| `manifest.webmanifest` | PWA 安裝設定（名稱、圖示、顯示模式） |
| `sw.js` | Service Worker，快取殼層讓 App 可安裝且支援離線開啟 |
| `icons/` | 192 / 512 / 180（iOS）App 圖示 |
| `build-icons.cjs` | 純 Node（無相依套件）圖示產生器 |

## 部署

以 GitHub Pages 託管。推送到 `main` 分支後，於 **Settings → Pages** 啟用（Source: `main` / `/`）。

## 本機預覽

```bash
npx serve .
# 或
python -m http.server 8000
```

PWA 需在 HTTPS（或 localhost）下才能安裝。

## 重新產生圖示

```bash
node build-icons.cjs
```

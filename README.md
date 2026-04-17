# 🛒 Bazaar Live

A live GitHub Pages dashboard that compares daily grocery prices across major Bangladesh supershops — **Shwapno, Meena Bazar, Unimart, and Chaldal**.

Prices are scraped daily by a GitHub Actions workflow and committed to `data/prices.json`. The frontend is pure HTML/JS with no backend.

🌐 **Live site:** [faisalnabil.github.io/bazaar-live](https://faisalnabil.github.io/bazaar-live/)

---

## Project structure

```
bazaar-live/
├── index.html                   # Dashboard (GitHub Pages entry point)
├── data/
│   └── prices.json              # Scraped prices (auto-committed by Actions)
├── scraper/
│   └── scrape.js                # Node.js scraper (runs in GitHub Actions only)
├── package.json
├── .gitignore
└── .github/
    └── workflows/
        ├── scrape.yml           # Daily scheduled scraper
        └── pages.yml            # GitHub Pages auto-deployment
```

---

## Setup instructions

### 1. Create the GitHub repository

```bash
git init
git add .
git commit -m "init: Bazaar Live"
git branch -M main
git remote add origin https://github.com/FaisalNabil/bazaar-live.git
git push -u origin main
```

### 2. Enable GitHub Pages via Actions

- Go to your repo → **Settings** → **Pages**
- Source: **GitHub Actions**
- The `pages.yml` workflow handles deployment automatically on every push to `main`

### 3. Allow Actions to commit

- Go to **Settings** → **Actions** → **General**
- Under "Workflow permissions" → select **Read and write permissions**
- Save

### 4. Trigger the first scrape manually

- Go to **Actions** tab → **Daily Price Scraper** → **Run workflow**
- The workflow will scrape prices and commit an updated `data/prices.json`, which also triggers a Pages redeploy

After that, it runs automatically every day at **12:00 noon Bangladesh time** (06:00 UTC).

---

## How the scraper works

| Shop | Method |
|------|--------|
| **Chaldal** | Internal REST API (`chaldal.com/api/Search`) — fast, no JS rendering |
| **Shwapno** | Puppeteer (headless Chrome) — React SPA requires JS |
| **Meena Bazar** | Puppeteer (headless Chrome) |
| **Unimart** | Puppeteer (headless Chrome) |

**Fallback:** If a scrape fails for any reason, the previous price is kept in `prices.json` with `"stale": true` flagged so the dashboard can show it clearly.

---

## Updating the product list

Edit `PRODUCTS` in `scraper/scrape.js` to add, remove, or update products. Each entry needs:

```js
{
  id: "unique-id",
  name: "Display Name",
  unit: "1 kg",
  category: "Category",
  chaldal: { search: "search query for chaldal API" },
  shwapno: { url: "https://www.shwapno.com/product-slug" },
  meena:   { url: "https://www.meenabazar.com.bd/product/..." },
  unimart: { url: "https://unimart.com.bd/product/..." },
}
```

Also add a matching seed entry to `data/prices.json` so the dashboard shows something before the first scrape.

---

## Notes

- The scraper uses polite delays between requests and a real browser User-Agent.
- Puppeteer uses headless Chromium bundled in the npm package — no extra setup needed.
- GitHub Actions free tier gives 2,000 minutes/month — this workflow uses ~5 min/day, well within limits.
- If a shop changes its DOM structure, update the CSS selectors in the corresponding `scrape*` function in `scrape.js`.

/**
 * BD Supershop Price Scraper
 * Runs inside GitHub Actions (Node.js 20, headless Chromium via Puppeteer).
 * Writes results to data/prices.json in the repo root.
 *
 * Strategy per shop:
 *   - Chaldal     : internal REST API (JSON, no JS rendering needed)
 *   - Shwapno     : Puppeteer (React SPA, needs full JS)
 *   - Meena Bazar : Puppeteer (React SPA)
 *   - Unimart     : Puppeteer (WooCommerce with JS-heavy product pages)
 *
 * Fallback: if a scrape fails, the previous price is kept and "stale: true" is flagged.
 */

import puppeteer from "puppeteer";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, "..", "data", "prices.json");

// ─── Product manifest ────────────────────────────────────────────────────────
// Each entry maps a canonical product id to shop-specific search/URL hints.
// The scraper uses these to navigate and extract prices.
const PRODUCTS = [
  {
    id: "miniket-rice",
    name: "Miniket Rice",
    unit: "1 kg",
    category: "Grains",
    chaldal: { search: "miniket rice 1kg", productId: 1234 },
    shwapno: { url: "https://www.shwapno.com/miniket-rice-1kg" },
    meena: { url: "https://www.meenabazar.com.bd/product/miniket-rice-1kg" },
    unimart: { url: "https://unimart.com.bd/product/miniket-rice" },
  },
  {
    id: "nazirshail-rice",
    name: "Nazirshail Rice",
    unit: "1 kg",
    category: "Grains",
    chaldal: { search: "nazirshail rice 1kg" },
    shwapno: { url: "https://www.shwapno.com/nazirshail-rice-1kg" },
    meena: { url: "https://www.meenabazar.com.bd/product/nazirshail-rice-1kg" },
    unimart: { url: "https://unimart.com.bd/product/nazirshail-rice" },
  },
  {
    id: "masur-dal",
    name: "Lentil (Masur Dal)",
    unit: "1 kg",
    category: "Pulses",
    chaldal: { search: "masur dal 1kg" },
    shwapno: { url: "https://www.shwapno.com/masur-dal-1kg" },
    meena: { url: "https://www.meenabazar.com.bd/product/masur-dal-1kg" },
    unimart: { url: "https://unimart.com.bd/product/masur-dal" },
  },
  {
    id: "soybean-oil",
    name: "Soybean Oil",
    unit: "1 L",
    category: "Oils",
    chaldal: { search: "soybean oil 1 liter" },
    shwapno: { url: "https://www.shwapno.com/soybean-oil-1l" },
    meena: { url: "https://www.meenabazar.com.bd/product/soybean-oil-1ltr" },
    unimart: { url: "https://unimart.com.bd/product/soybean-oil-1l" },
  },
  {
    id: "mustard-oil",
    name: "Mustard Oil",
    unit: "1 L",
    category: "Oils",
    chaldal: { search: "mustard oil 1 liter" },
    shwapno: { url: "https://www.shwapno.com/mustard-oil-1l" },
    meena: { url: "https://www.meenabazar.com.bd/product/mustard-oil-1l" },
    unimart: { url: "https://unimart.com.bd/product/mustard-oil-1l" },
  },
  {
    id: "broiler-chicken",
    name: "Chicken (Broiler)",
    unit: "1 kg",
    category: "Meat & Fish",
    chaldal: { search: "broiler chicken 1kg" },
    shwapno: { url: "https://www.shwapno.com/broiler-chicken" },
    meena: { url: "https://www.meenabazar.com.bd/product/broiler-chicken" },
    unimart: { url: "https://unimart.com.bd/product/broiler-chicken" },
  },
  {
    id: "beef",
    name: "Beef (Bone-in)",
    unit: "1 kg",
    category: "Meat & Fish",
    chaldal: { search: "beef bone in 1kg" },
    shwapno: { url: "https://www.shwapno.com/beef-bone-in-1kg" },
    meena: { url: "https://www.meenabazar.com.bd/product/beef-bone-in" },
    unimart: { url: "https://unimart.com.bd/product/beef-bone-in" },
  },
  {
    id: "rui-fish",
    name: "Rui Fish",
    unit: "1 kg",
    category: "Meat & Fish",
    chaldal: { search: "rui fish 1kg" },
    shwapno: { url: "https://www.shwapno.com/rui-fish-1kg" },
    meena: { url: "https://www.meenabazar.com.bd/product/rui-fish" },
    unimart: { url: "https://unimart.com.bd/product/rui-fish" },
  },
  {
    id: "egg-deshi",
    name: "Egg (Deshi)",
    unit: "1 dozen",
    category: "Dairy & Eggs",
    chaldal: { search: "deshi egg 12 pcs" },
    shwapno: { url: "https://www.shwapno.com/deshi-egg-12pcs" },
    meena: { url: "https://www.meenabazar.com.bd/product/deshi-egg-12pcs" },
    unimart: { url: "https://unimart.com.bd/product/deshi-egg-12pcs" },
  },
  {
    id: "pasteurized-milk",
    name: "Milk (Pasteurized)",
    unit: "1 L",
    category: "Dairy & Eggs",
    chaldal: { search: "pasteurized milk 1 liter" },
    shwapno: { url: "https://www.shwapno.com/pasteurized-milk-1l" },
    meena: { url: "https://www.meenabazar.com.bd/product/pasteurized-milk-1l" },
    unimart: { url: "https://unimart.com.bd/product/pasteurized-milk-1l" },
  },
  {
    id: "potato",
    name: "Potato",
    unit: "1 kg",
    category: "Vegetables",
    chaldal: { search: "potato 1kg" },
    shwapno: { url: "https://www.shwapno.com/potato-1kg" },
    meena: { url: "https://www.meenabazar.com.bd/product/potato-1kg" },
    unimart: { url: "https://unimart.com.bd/product/potato-1kg" },
  },
  {
    id: "onion",
    name: "Onion",
    unit: "1 kg",
    category: "Vegetables",
    chaldal: { search: "onion 1kg" },
    shwapno: { url: "https://www.shwapno.com/onion-1kg" },
    meena: { url: "https://www.meenabazar.com.bd/product/onion-1kg" },
    unimart: { url: "https://unimart.com.bd/product/onion-1kg" },
  },
  {
    id: "tomato",
    name: "Tomato",
    unit: "1 kg",
    category: "Vegetables",
    chaldal: { search: "tomato 1kg" },
    shwapno: { url: "https://www.shwapno.com/tomato-1kg" },
    meena: { url: "https://www.meenabazar.com.bd/product/tomato-1kg" },
    unimart: { url: "https://unimart.com.bd/product/tomato-1kg" },
  },
  {
    id: "garlic",
    name: "Garlic",
    unit: "1 kg",
    category: "Spices",
    chaldal: { search: "garlic 1kg" },
    shwapno: { url: "https://www.shwapno.com/garlic-1kg" },
    meena: { url: "https://www.meenabazar.com.bd/product/garlic-1kg" },
    unimart: { url: "https://unimart.com.bd/product/garlic-1kg" },
  },
  {
    id: "sugar",
    name: "Sugar",
    unit: "1 kg",
    category: "Grains",
    chaldal: { search: "sugar 1kg" },
    shwapno: { url: "https://www.shwapno.com/sugar-1kg" },
    meena: { url: "https://www.meenabazar.com.bd/product/sugar-1kg" },
    unimart: { url: "https://unimart.com.bd/product/sugar-1kg" },
  },
  {
    id: "atta",
    name: "Atta (Wheat Flour)",
    unit: "1 kg",
    category: "Grains",
    chaldal: { search: "atta wheat flour 1kg" },
    shwapno: { url: "https://www.shwapno.com/atta-1kg" },
    meena: { url: "https://www.meenabazar.com.bd/product/atta-1kg" },
    unimart: { url: "https://unimart.com.bd/product/atta-1kg" },
  },
  {
    id: "banana",
    name: "Banana (Sagar)",
    unit: "1 dozen",
    category: "Fruits",
    chaldal: { search: "sagar banana dozen" },
    shwapno: { url: "https://www.shwapno.com/sagar-banana-dozen" },
    meena: { url: "https://www.meenabazar.com.bd/product/sagar-banana" },
    unimart: { url: "https://unimart.com.bd/product/banana-dozen" },
  },
  {
    id: "green-chilli",
    name: "Green Chilli",
    unit: "250 g",
    category: "Vegetables",
    chaldal: { search: "green chilli 250g" },
    shwapno: { url: "https://www.shwapno.com/green-chilli-250g" },
    meena: { url: "https://www.meenabazar.com.bd/product/green-chilli-250g" },
    unimart: { url: "https://unimart.com.bd/product/green-chilli-250g" },
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Extract the first integer/decimal price found in a text string */
function extractPrice(text) {
  if (!text) return null;
  const cleaned = text.replace(/,/g, "");
  const match = cleaned.match(/(\d+(?:\.\d+)?)/);
  return match ? Math.round(parseFloat(match[1])) : null;
}

// ─── Chaldal scraper (JSON API) ──────────────────────────────────────────────
async function scrapeChaldal(product) {
  const AREA_ID = 1; // Dhaka area
  const BASE = "https://chaldal.com/api/";
  const searchUrl = `${BASE}Search?query=${encodeURIComponent(product.chaldal.search)}&pageNumber=0&areaId=${AREA_ID}`;

  try {
    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; PriceBot/1.0; +https://github.com)",
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // Chaldal returns an array of product groups; find best match
    const items = data?.products ?? data ?? [];
    if (!items.length) throw new Error("No results");

    const first = Array.isArray(items[0]?.products)
      ? items[0].products[0]
      : items[0];
    const price = first?.price ?? first?.discountedPrice ?? first?.regularPrice;

    if (!price) throw new Error("Price field not found");
    return { price: Math.round(price), available: true, stale: false };
  } catch (err) {
    log(`  [Chaldal] ${product.name}: FAILED — ${err.message}`);
    return null;
  }
}

// ─── Puppeteer-based scrapers ────────────────────────────────────────────────

/**
 * Generic Puppeteer scraper.
 * Navigates to URL and tries a list of CSS selectors for the price element.
 */
async function scrapeWithPuppeteer(page, url, selectors) {
  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(1500);

    for (const sel of selectors) {
      try {
        await page.waitForSelector(sel, { timeout: 5000 });
        const text = await page.$eval(sel, (el) => el.innerText);
        const price = extractPrice(text);
        if (price && price > 0) return { price, available: true, stale: false };
      } catch {
        // try next selector
      }
    }
    throw new Error("No price found with any selector");
  } catch (err) {
    log(`  [Puppeteer] ${url}: FAILED — ${err.message}`);
    return null;
  }
}

async function scrapeShwapno(page, product) {
  const selectors = [
    ".product-price .selling-price",
    "[data-testid='product-price']",
    ".price-box .price",
    "span.price",
    ".product-detail-price",
  ];
  return scrapeWithPuppeteer(page, product.shwapno.url, selectors);
}

async function scrapeMeena(page, product) {
  const selectors = [
    ".product-price",
    ".woocommerce-Price-amount",
    ".price ins .amount",
    ".price .amount",
    "span.price",
  ];
  return scrapeWithPuppeteer(page, product.meena.url, selectors);
}

async function scrapeUnimart(page, product) {
  const selectors = [
    ".product_price",
    ".woocommerce-Price-amount",
    ".price ins .amount",
    ".price .amount",
    ".entry-summary .price",
  ];
  return scrapeWithPuppeteer(page, product.unimart.url, selectors);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  log("Starting BD supershop price scraper");

  // Load existing data to use as fallback
  let existing = { products: [] };
  try {
    existing = JSON.parse(readFileSync(DATA_PATH, "utf-8"));
  } catch {
    log("No existing data file found — starting fresh");
  }

  const existingMap = {};
  for (const p of existing.products ?? []) existingMap[p.id] = p;

  // Launch Puppeteer
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
  );
  await page.setViewport({ width: 1280, height: 800 });

  const results = [];

  for (const product of PRODUCTS) {
    log(`Processing: ${product.name}`);
    const prev = existingMap[product.id];

    const makeEntry = (shopKey, shopName, scraped) => {
      const prevShop = prev?.prices?.[shopName];
      if (scraped) {
        return {
          price: scraped.price,
          available: scraped.available,
          stale: false,
          scraped_at: new Date().toISOString(),
        };
      }
      // Fallback: keep old price, mark stale
      return {
        price: prevShop?.price ?? null,
        available: prevShop?.available ?? false,
        stale: true,
        scraped_at: prevShop?.scraped_at ?? null,
      };
    };

    const [chaldalResult, shwapnoResult, meenaResult, unimartResult] =
      await Promise.allSettled([
        scrapeChaldal(product),
        scrapeShwapno(page, product),
        scrapeMeena(page, product),
        scrapeUnimart(page, product),
      ]);

    results.push({
      id: product.id,
      name: product.name,
      unit: product.unit,
      category: product.category,
      prices: {
        Shwapno: makeEntry(
          "shwapno",
          "Shwapno",
          shwapnoResult.status === "fulfilled" ? shwapnoResult.value : null
        ),
        "Meena Bazar": makeEntry(
          "meena",
          "Meena Bazar",
          meenaResult.status === "fulfilled" ? meenaResult.value : null
        ),
        Unimart: makeEntry(
          "unimart",
          "Unimart",
          unimartResult.status === "fulfilled" ? unimartResult.value : null
        ),
        Chaldal: makeEntry(
          "chaldal",
          "Chaldal",
          chaldalResult.status === "fulfilled" ? chaldalResult.value : null
        ),
      },
    });

    await sleep(800); // polite delay between products
  }

  await browser.close();

  const output = {
    last_updated: new Date().toISOString(),
    source_note: "Prices in BDT. Auto-updated daily via GitHub Actions.",
    products: results,
  };

  writeFileSync(DATA_PATH, JSON.stringify(output, null, 2));
  log(`Done. Wrote ${results.length} products to ${DATA_PATH}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

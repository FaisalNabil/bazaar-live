/**
 * Bazaar Live — URL Discovery Tool
 * ─────────────────────────────────
 * Run this ONCE locally to find real product URLs from all 4 shops.
 * It launches a visible browser, searches each shop for every product,
 * clicks the first match, and records the URL.
 *
 * Output: scraper/discovered-urls.json  (feed this into scrape.js)
 *
 * Usage (from repo root):
 *   node scraper/find-urls.js
 *
 * Requires: npm install  (Puppeteer already in package.json)
 */

import puppeteer from "puppeteer";
import { writeFileSync, existsSync, readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, "discovered-urls.json");

// ─── Products to search for ───────────────────────────────────────────────────
const PRODUCTS = [
  { id: "miniket-rice",      name: "Miniket Rice",          searches: { chaldal: "miniket rice 1kg",        shwapno: "miniket rice",        meena: "miniket rice",         unimart: "miniket rice" } },
  { id: "nazirshail-rice",   name: "Nazirshail Rice",       searches: { chaldal: "nazirshail rice 1kg",     shwapno: "nazirshail rice",     meena: "nazirshail rice",      unimart: "nazirshail rice" } },
  { id: "masur-dal",         name: "Lentil (Masur Dal)",    searches: { chaldal: "masur dal 1kg",           shwapno: "masur dal",           meena: "masur dal",            unimart: "masur dal" } },
  { id: "soybean-oil",       name: "Soybean Oil",           searches: { chaldal: "soybean oil 1 liter",    shwapno: "soybean oil 1L",      meena: "soybean oil 1L",       unimart: "soybean oil 1L" } },
  { id: "mustard-oil",       name: "Mustard Oil",           searches: { chaldal: "mustard oil 1 liter",    shwapno: "mustard oil",         meena: "mustard oil",          unimart: "mustard oil" } },
  { id: "broiler-chicken",   name: "Chicken (Broiler)",     searches: { chaldal: "broiler chicken",        shwapno: "broiler chicken",     meena: "broiler chicken",      unimart: "broiler chicken" } },
  { id: "beef",              name: "Beef (Bone-in)",        searches: { chaldal: "beef bone in",           shwapno: "beef",                meena: "beef",                 unimart: "beef" } },
  { id: "rui-fish",          name: "Rui Fish",              searches: { chaldal: "rui fish 1kg",           shwapno: "rui fish",            meena: "rui fish",             unimart: "rui fish" } },
  { id: "egg-deshi",         name: "Egg (Deshi)",           searches: { chaldal: "deshi egg 12 pcs",       shwapno: "deshi egg",           meena: "deshi egg",            unimart: "deshi egg" } },
  { id: "pasteurized-milk",  name: "Milk (Pasteurized)",   searches: { chaldal: "pasteurized milk 1L",    shwapno: "pasteurized milk",    meena: "pasteurized milk",     unimart: "pasteurized milk" } },
  { id: "potato",            name: "Potato",                searches: { chaldal: "potato 1kg",             shwapno: "potato",              meena: "potato",               unimart: "potato" } },
  { id: "onion",             name: "Onion",                 searches: { chaldal: "onion 1kg",              shwapno: "onion",               meena: "onion",                unimart: "onion" } },
  { id: "tomato",            name: "Tomato",                searches: { chaldal: "tomato 1kg",             shwapno: "tomato",              meena: "tomato",               unimart: "tomato" } },
  { id: "garlic",            name: "Garlic",                searches: { chaldal: "garlic 1kg",             shwapno: "garlic",              meena: "garlic",               unimart: "garlic" } },
  { id: "sugar",             name: "Sugar",                 searches: { chaldal: "sugar 1kg",              shwapno: "sugar",               meena: "sugar",                unimart: "sugar" } },
  { id: "atta",              name: "Atta (Wheat Flour)",    searches: { chaldal: "atta wheat flour 1kg",   shwapno: "atta",                meena: "atta",                 unimart: "atta" } },
  { id: "banana",            name: "Banana (Sagar)",        searches: { chaldal: "sagar banana",           shwapno: "sagar banana",        meena: "sagar banana",         unimart: "banana" } },
  { id: "green-chilli",      name: "Green Chilli",          searches: { chaldal: "green chilli 250g",      shwapno: "green chilli",        meena: "green chilli",         unimart: "green chilli" } },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Load existing results so we can resume if interrupted
function loadExisting() {
  if (existsSync(OUT_PATH)) {
    try { return JSON.parse(readFileSync(OUT_PATH, "utf-8")); } catch {}
  }
  return {};
}

function save(data) {
  writeFileSync(OUT_PATH, JSON.stringify(data, null, 2));
}

// ─── Chaldal ──────────────────────────────────────────────────────────────────
// Chaldal is a React SPA — search results appear at /search?q=...
// We intercept XHR to capture their internal API response and grab productPageUrl
async function findChaldal(page, product) {
  const query = product.searches.chaldal;
  log(`  [Chaldal] Searching: "${query}"`);

  try {
    const apiResponses = [];

    // Listen for API responses
    page.on("response", async (response) => {
      const url = response.url();
      if (url.includes("chaldal.com/api") && response.status() === 200) {
        try {
          const json = await response.json();
          apiResponses.push({ url, json });
        } catch {}
      }
    });

    await page.goto(`https://chaldal.com/search?q=${encodeURIComponent(query)}`, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });
    await sleep(3000);

    // Try to grab first product link from the page
    const productUrl = await page.evaluate(() => {
      // Chaldal product links typically look like /product-name
      const links = Array.from(document.querySelectorAll("a[href]"));
      const productLink = links.find(a => {
        const href = a.href;
        return (
          href.includes("chaldal.com") &&
          !href.includes("/search") &&
          !href.includes("/category") &&
          !href.includes("/login") &&
          !href.includes("/cart") &&
          a.closest("[class*='product']") !== null
        );
      });
      return productLink ? productLink.href : null;
    });

    if (productUrl) {
      log(`  [Chaldal] Found: ${productUrl}`);
      return productUrl;
    }

    // Fallback: grab any product-looking link
    const fallback = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll("a[href]"));
      const productLink = links.find(a =>
        a.href.startsWith("https://chaldal.com/") &&
        a.href.split("/").length >= 4 &&
        !a.href.includes("search") &&
        !a.href.includes("category") &&
        !a.href.includes("login") &&
        !a.href.includes("cart") &&
        !a.href.endsWith("chaldal.com/")
      );
      return productLink ? productLink.href : null;
    });

    if (fallback) {
      log(`  [Chaldal] Found (fallback): ${fallback}`);
      return fallback;
    }

    // Also check if we captured any API data
    for (const r of apiResponses) {
      if (r.url.includes("Search") || r.url.includes("Product")) {
        log(`  [Chaldal] API hit: ${r.url}`);
        // Try to extract first product URL from API response
        const items = r.json?.products ?? r.json ?? [];
        const first = Array.isArray(items[0]?.products) ? items[0].products[0] : items[0];
        if (first?.pageUrl) return `https://chaldal.com${first.pageUrl}`;
        if (first?.slug)    return `https://chaldal.com/${first.slug}`;
      }
    }

    log(`  [Chaldal] NOT FOUND`);
    return null;
  } catch (err) {
    log(`  [Chaldal] ERROR — ${err.message}`);
    return null;
  }
}

// ─── Shwapno ──────────────────────────────────────────────────────────────────
async function findShwapno(page, product) {
  const query = product.searches.shwapno;
  log(`  [Shwapno] Searching: "${query}"`);

  try {
    await page.goto(`https://www.shwapno.com/search?q=${encodeURIComponent(query)}`, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });
    await sleep(3000);

    const url = await page.evaluate(() => {
      // Shwapno product links
      const selectors = [
        "a[href*='/product/']",
        "a[href*='/products/']",
        ".product-item a",
        ".product-card a",
        "[class*='product'] a",
        ".grid a[href]",
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el?.href) return el.href;
      }
      // Generic: any link that looks like a product
      const links = Array.from(document.querySelectorAll("a[href]"));
      const link = links.find(a =>
        a.href.includes("shwapno.com") &&
        (a.href.includes("/product") || a.href.split("/").filter(Boolean).length >= 4) &&
        !a.href.includes("search") &&
        !a.href.includes("category") &&
        !a.href.includes("cart") &&
        !a.href.endsWith("shwapno.com/")
      );
      return link ? link.href : null;
    });

    if (url) { log(`  [Shwapno] Found: ${url}`); return url; }
    log(`  [Shwapno] NOT FOUND`);
    return null;
  } catch (err) {
    log(`  [Shwapno] ERROR — ${err.message}`);
    return null;
  }
}

// ─── Meena Bazar ──────────────────────────────────────────────────────────────
async function findMeena(page, product) {
  const query = product.searches.meena;
  log(`  [Meena] Searching: "${query}"`);

  try {
    // Try both common search URL patterns
    const searchUrls = [
      `https://www.meenabazar.com.bd/?s=${encodeURIComponent(query)}`,
      `https://www.meenabazar.com.bd/search?q=${encodeURIComponent(query)}`,
      `https://www.meenabazar.com.bd/product-search?q=${encodeURIComponent(query)}`,
    ];

    for (const searchUrl of searchUrls) {
      try {
        await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 20000 });
        await sleep(2000);

        const url = await page.evaluate(() => {
          const selectors = [
            "a[href*='/product/']",
            ".product a",
            ".woocommerce-loop-product__link",
            ".wc-block-grid__product a",
            "[class*='product'] a[href]",
          ];
          for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el?.href && !el.href.includes("?add-to-cart=")) return el.href;
          }
          return null;
        });

        if (url) { log(`  [Meena] Found: ${url}`); return url; }
      } catch {}
    }

    log(`  [Meena] NOT FOUND`);
    return null;
  } catch (err) {
    log(`  [Meena] ERROR — ${err.message}`);
    return null;
  }
}

// ─── Unimart ──────────────────────────────────────────────────────────────────
async function findUnimart(page, product) {
  const query = product.searches.unimart;
  log(`  [Unimart] Searching: "${query}"`);

  try {
    await page.goto(`https://unimart.com.bd/?s=${encodeURIComponent(query)}&post_type=product`, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });
    await sleep(2000);

    const url = await page.evaluate(() => {
      const selectors = [
        "a[href*='/product/']",
        ".woocommerce-loop-product__link",
        ".product a",
        ".wc-block-grid__product a",
        "ul.products li a",
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el?.href && !el.href.includes("?add-to-cart=")) return el.href;
      }
      return null;
    });

    if (url) { log(`  [Unimart] Found: ${url}`); return url; }
    log(`  [Unimart] NOT FOUND`);
    return null;
  } catch (err) {
    log(`  [Unimart] ERROR — ${err.message}`);
    return null;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  log("=== Bazaar Live — URL Discovery ===");
  log(`Output: ${OUT_PATH}`);
  log("");

  const results = loadExisting();
  log(`Resuming with ${Object.keys(results).length} already-found products\n`);

  const browser = await puppeteer.launch({
    headless: false,          // Visible browser — you can watch it work
    defaultViewport: null,    // Full window size
    args: ["--start-maximized"],
  });

  // Use separate pages per shop to avoid cross-contamination
  const pages = {
    chaldal: await browser.newPage(),
    shwapno: await browser.newPage(),
    meena:   await browser.newPage(),
    unimart: await browser.newPage(),
  };

  for (const p of Object.values(pages)) {
    await p.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36"
    );
  }

  for (const product of PRODUCTS) {
    log(`\n── ${product.name} (${product.id}) ──`);

    if (!results[product.id]) results[product.id] = {};

    const shops = [
      { key: "chaldal", fn: findChaldal,  page: pages.chaldal },
      { key: "shwapno", fn: findShwapno,  page: pages.shwapno },
      { key: "meena",   fn: findMeena,    page: pages.meena   },
      { key: "unimart", fn: findUnimart,  page: pages.unimart },
    ];

    for (const shop of shops) {
      // Skip if already found
      if (results[product.id][shop.key]) {
        log(`  [${shop.key}] Already found — skipping`);
        continue;
      }
      const url = await shop.fn(shop.page, product);
      results[product.id][shop.key] = url ?? "NOT_FOUND";
      save(results); // Save after every attempt so progress isn't lost
      await sleep(500);
    }
  }

  await browser.close();

  log("\n=== Done! ===");
  log(`Results saved to: ${OUT_PATH}`);
  log("\nSummary:");

  for (const [id, urls] of Object.entries(results)) {
    const found = Object.values(urls).filter(u => u && u !== "NOT_FOUND").length;
    log(`  ${id}: ${found}/4 shops found`);
  }

  log("\nNext step: share discovered-urls.json with Claude to update the scraper!");
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});

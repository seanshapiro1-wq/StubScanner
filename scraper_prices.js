const puppeteer = require('puppeteer');
const fs = require('fs');

const url = process.argv[2];
if (!url) {
  console.error('Usage: node scraper_prices.js <url>');
  process.exit(1);
}

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  const page = await browser.newPage();

  // Anti-detection
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
  });

  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

  // Block images/fonts for speed
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const t = req.resourceType();
    if (t === 'image' || t === 'font' || t === 'media') req.abort();
    else req.continue();
  });

  // Capture API responses with price data
  const apiData = [];
  page.on('response', async (resp) => {
    const u = resp.url().toLowerCase();
    if (
      u.includes('offers') ||
      u.includes('inventory') ||
      u.includes('quickpicks') ||
      u.includes('availability') ||
      u.includes('price')
    ) {
      try {
        const body = await resp.json();
        apiData.push({ url: resp.url(), data: body });
      } catch {}
    }
  });

  try {
    console.error(`Navigating to: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Wait for ticket list to render
    console.error('Waiting for ticket list...');
    try {
      await page.waitForSelector(
        '[data-testid*="quick-pick"], [data-testid*="ticket"], [class*="quick-pick"], [class*="QuickPicks"], [class*="ticketList"]',
        { timeout: 30000 }
      );
      console.error('Ticket list detected!');
    } catch {
      console.error('Ticket list selector timed out');
    }

    // Scroll to trigger lazy loading
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await new Promise(r => setTimeout(r, 2000));
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(r => setTimeout(r, 3000));
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise(r => setTimeout(r, 2000));

    // Extract prices from DOM
    const domData = await page.evaluate(() => {
      const result = { prices: [], ticketCards: [] };
      const allText = document.body.innerText || '';
      const matches = allText.match(/\$[\d,]+(?:\.\d{2})?/g) || [];
      result.prices = [...new Set(matches)];

      const cards = document.querySelectorAll(
        '[data-testid*="quick-pick"], [data-testid*="ticket-card"], [class*="quick-pick"], [class*="QuickPick"], li[class*="ticket"]'
      );
      cards.forEach((c) => {
        const t = (c.innerText || '').trim();
        if (t) result.ticketCards.push(t);
      });
      return result;
    });

    const html = await page.content();

    const result = {
      url,
      dom_prices: domData.prices,
      ticket_cards: domData.ticketCards,
      api_responses_count: apiData.length,
      api_responses: apiData,
      html_length: html.length,
    };

    const ts = Date.now();
    fs.writeFileSync(`prices_${ts}.json`, JSON.stringify(result, null, 2));
    fs.writeFileSync(`debug_${ts}.html`, html);

    console.error(`\nSaved prices_${ts}.json and debug_${ts}.html`);
    console.error(`Found ${result.dom_prices.length} prices, ${result.ticket_cards.length} ticket cards, ${result.api_responses_count} API responses`);
    if (result.dom_prices.length > 0) {
      console.error('\nPrices found:');
      result.dom_prices.forEach((p) => console.error(`  ${p}`));
    }
    console.log(JSON.stringify({ dom_prices: result.dom_prices, ticket_cards: result.ticket_cards, api_count: result.api_responses_count }, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();

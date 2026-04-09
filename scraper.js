const puppeteer = require('puppeteer');

const url = process.argv[2];
if (!url) {
  console.error('Usage: node scraper.js <url>');
  console.error('Example: node scraper.js "https://www.ticketmaster.com/event/..."');
  process.exit(1);
}

const outputMode = process.argv[3] || 'html'; // 'html' or 'file'

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const page = await browser.newPage();

  // Mimic a real browser
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

  try {
    console.error(`Navigating to: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // Wait for dynamic content to render
    await new Promise(r => setTimeout(r, 5000));

    const html = await page.content();

    if (outputMode === 'file') {
      const fs = require('fs');
      const filename = `scraped_${Date.now()}.html`;
      fs.writeFileSync(filename, html);
      console.error(`Saved to ${filename} (${html.length} bytes)`);
    } else {
      console.log(html);
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();

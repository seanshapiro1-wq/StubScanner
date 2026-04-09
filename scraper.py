import sys
import json
import time

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("Playwright not installed. Run: pip install playwright && playwright install chromium")
    sys.exit(1)


def scrape_prices(url):
    prices = []
    api_data = []

    def capture_response(response):
        """Intercept API responses that contain ticket/price data."""
        resp_url = response.url
        if any(keyword in resp_url for keyword in [
            "offers", "inventory", "price", "ticket", "availability",
            "resale", "api/event", "shape", "quickpicks"
        ]):
            try:
                body = response.json()
                api_data.append({"url": resp_url, "data": body})
            except Exception:
                pass

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1920, "height": 1080},
            locale="en-US",
        )
        page = context.new_page()

        # Block heavy resources - images, stylesheets, fonts, media
        page.route("**/*.{png,jpg,jpeg,gif,svg,webp,woff,woff2,ttf,eot,mp4,mp3}", lambda route: route.abort())
        page.route("**/*", lambda route: route.abort() if route.request.resource_type in ["image", "stylesheet", "font", "media"] else route.continue_())

        # Listen for API responses with price data
        page.on("response", capture_response)

        print("Loading page...", file=sys.stderr)
        page.goto(url, wait_until="domcontentloaded", timeout=60000)

        # Shorter wait — we're listening for API calls, not rendering
        time.sleep(5)

        # Also scrape any visible prices from the DOM as fallback
        price_elements = page.evaluate("""
            () => {
                const results = [];
                // Common Ticketmaster price selectors
                const selectors = [
                    '[data-testid*="price"]',
                    '[class*="price"]',
                    '[class*="Price"]',
                    '[class*="cost"]',
                    '[class*="ticket"]',
                    '[aria-label*="price"]',
                    '[aria-label*="Price"]',
                ];
                for (const sel of selectors) {
                    document.querySelectorAll(sel).forEach(el => {
                        const text = el.innerText.trim();
                        if (text && text.match(/\\$[\\d,.]+/)) {
                            results.push(text);
                        }
                    });
                }
                // Also grab anything that looks like a dollar amount
                const allText = document.body.innerText;
                const dollarMatches = allText.match(/\\$[\\d,]+\\.?\\d{0,2}/g);
                if (dollarMatches) {
                    results.push(...dollarMatches);
                }
                return [...new Set(results)];
            }
        """)

        browser.close()

    output = {
        "url": url,
        "dom_prices": price_elements,
        "api_responses": api_data,
    }

    return output


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scraper.py <url>")
        sys.exit(1)

    url = sys.argv[1]
    result = scrape_prices(url)

    # Save raw JSON
    filename = f"prices_{int(time.time())}.json"
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)

    # Print summary
    print(f"\nSaved full data to {filename}", file=sys.stderr)
    print(json.dumps(result, indent=2))

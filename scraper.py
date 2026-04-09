import sys
import json
import time
import re

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("Playwright not installed. Run: pip install playwright && playwright install chromium")
    sys.exit(1)


def scrape_prices(url):
    api_data = []

    def capture_response(response):
        """Intercept API responses that contain ticket/price data."""
        resp_url = response.url
        if any(keyword in resp_url.lower() for keyword in [
            "offers", "inventory", "price", "quickpicks",
            "availability", "map", "shape"
        ]):
            try:
                body = response.json()
                api_data.append({"url": resp_url, "data": body})
            except Exception:
                pass

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--disable-features=IsolateOrigins,site-per-process",
                "--no-sandbox",
            ],
        )
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1920, "height": 1080},
            locale="en-US",
            timezone_id="America/New_York",
        )

        # Hide automation markers
        context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        """)

        page = context.new_page()

        # Only block images and fonts — keep CSS so layout renders properly
        def route_handler(route):
            if route.request.resource_type in ["image", "font", "media"]:
                route.abort()
            else:
                route.continue_()
        page.route("**/*", route_handler)

        page.on("response", capture_response)

        print("Loading page...", file=sys.stderr)
        page.goto(url, wait_until="domcontentloaded", timeout=60000)

        # Wait for the ticket list to actually render
        print("Waiting for ticket list to load...", file=sys.stderr)
        try:
            page.wait_for_selector(
                '[data-testid*="quick-pick"], [data-testid*="ticket"], [class*="quick-pick"], [class*="QuickPicks"], [class*="ticketList"], [class*="TicketList"]',
                timeout=30000,
            )
            print("Ticket list detected!", file=sys.stderr)
        except Exception:
            print("Ticket list selector timed out — continuing anyway", file=sys.stderr)

        # Scroll the page to trigger lazy-loaded content
        page.evaluate("window.scrollTo(0, document.body.scrollHeight / 2)")
        time.sleep(2)
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        time.sleep(3)
        page.evaluate("window.scrollTo(0, 0)")
        time.sleep(2)

        # Extract prices from the DOM
        dom_data = page.evaluate("""
            () => {
                const result = { prices: [], ticketCards: [] };

                // Grab all $XX.XX patterns from the full page text
                const allText = document.body.innerText || "";
                const dollarMatches = allText.match(/\\$[\\d,]+(?:\\.\\d{2})?/g) || [];
                result.prices = [...new Set(dollarMatches)];

                // Try to grab structured ticket card data
                const cards = document.querySelectorAll('[data-testid*="quick-pick"], [data-testid*="ticket-card"], [class*="quick-pick"], [class*="QuickPick"], li[class*="ticket"]');
                cards.forEach(card => {
                    const text = (card.innerText || "").trim();
                    if (text) result.ticketCards.push(text);
                });

                return result;
            }
        """)

        # Save the full rendered HTML for debugging
        html = page.content()

        browser.close()

    return {
        "url": url,
        "dom_prices": dom_data["prices"],
        "ticket_cards": dom_data["ticketCards"],
        "api_responses_count": len(api_data),
        "api_responses": api_data,
        "html_length": len(html),
    }, html


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scraper.py <url>")
        sys.exit(1)

    url = sys.argv[1]
    result, html = scrape_prices(url)

    ts = int(time.time())
    json_file = f"prices_{ts}.json"
    html_file = f"debug_{ts}.html"

    with open(json_file, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)
    with open(html_file, "w", encoding="utf-8") as f:
        f.write(html)

    print(f"\nSaved price data to {json_file}", file=sys.stderr)
    print(f"Saved debug HTML to {html_file}", file=sys.stderr)
    print(f"\nFound {len(result['dom_prices'])} prices, {len(result['ticket_cards'])} ticket cards, {result['api_responses_count']} API responses")
    if result["dom_prices"]:
        print("\nPrices found:")
        for p in result["dom_prices"]:
            print(f"  {p}")

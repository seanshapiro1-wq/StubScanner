import sys
import time

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("Playwright not installed. Run: pip install playwright && playwright install chromium")
    sys.exit(1)


def scrape(url, output_mode="html"):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1920, "height": 1080},
            locale="en-US",
        )
        page = context.new_page()

        print(f"Navigating to: {url}", file=sys.stderr)
        page.goto(url, wait_until="networkidle", timeout=60000)

        # Wait for dynamic content
        time.sleep(5)

        html = page.content()

        if output_mode == "file":
            filename = f"scraped_{int(time.time())}.html"
            with open(filename, "w", encoding="utf-8") as f:
                f.write(html)
            print(f"Saved to {filename} ({len(html)} bytes)", file=sys.stderr)
        else:
            print(html)

        browser.close()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scraper.py <url> [html|file]")
        print('Example: python scraper.py "https://www.ticketmaster.com/event/..." file')
        sys.exit(1)

    url = sys.argv[1]
    mode = sys.argv[2] if len(sys.argv) > 2 else "html"
    scrape(url, mode)

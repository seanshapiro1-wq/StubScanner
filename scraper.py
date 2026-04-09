import sys
import os
import json
import time
import urllib.parse
import urllib.request

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("Playwright not installed. Run: pip install playwright && playwright install chromium")
    sys.exit(1)


DISCOVERY_API = "https://app.ticketmaster.com/discovery/v2/events.json"


def get_api_key():
    """Read Ticketmaster API key from env var or .env file."""
    key = os.environ.get("TICKETMASTER_API_KEY")
    if key:
        return key
    # Fallback: look for a .env file next to this script
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line.startswith("TICKETMASTER_API_KEY="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None


def search_events(keyword, size=5):
    """Call Ticketmaster Discovery API and return top N events."""
    api_key = get_api_key()
    if not api_key:
        print("ERROR: TICKETMASTER_API_KEY not set.", file=sys.stderr)
        print("Get a free key at https://developer.ticketmaster.com/user/register", file=sys.stderr)
        print("Then either:", file=sys.stderr)
        print("  1. Set env var: export TICKETMASTER_API_KEY=your_key_here", file=sys.stderr)
        print("  2. Or create a .env file with: TICKETMASTER_API_KEY=your_key_here", file=sys.stderr)
        sys.exit(1)

    params = {
        "apikey": api_key,
        "keyword": keyword,
        "size": size,
        "sort": "date,asc",
    }
    url = DISCOVERY_API + "?" + urllib.parse.urlencode(params)

    print(f"Searching for: {keyword}...", file=sys.stderr)
    try:
        with urllib.request.urlopen(url, timeout=15) as resp:
            data = json.loads(resp.read().decode())
    except Exception as e:
        print(f"Discovery API error: {e}", file=sys.stderr)
        sys.exit(1)

    events = data.get("_embedded", {}).get("events", [])
    if not events:
        print(f"No events found for '{keyword}'.")
        sys.exit(0)
    return events


def choose_event(events):
    """Print top events and let the user pick one."""
    print("\nTop results:\n")
    for i, ev in enumerate(events, 1):
        name = ev.get("name", "Unknown")
        date_info = ev.get("dates", {}).get("start", {})
        date = date_info.get("localDate", "TBD")
        tm = date_info.get("localTime", "")
        venue = ""
        venues = ev.get("_embedded", {}).get("venues", [])
        if venues:
            v = venues[0]
            city = v.get("city", {}).get("name", "")
            state = v.get("state", {}).get("stateCode", "")
            venue = f"{v.get('name', '')} — {city}, {state}".strip(" —,")
        print(f"  {i}. {name}")
        print(f"     {date} {tm}  |  {venue}")
    print()

    while True:
        try:
            choice = input(f"Pick an event (1-{len(events)}): ").strip()
            idx = int(choice)
            if 1 <= idx <= len(events):
                return events[idx - 1]
            print(f"Please enter a number between 1 and {len(events)}.")
        except ValueError:
            print("Please enter a valid number.")


def prompt_for_quantity():
    """Ask the user how many tickets they want to filter by."""
    while True:
        try:
            raw = input("How many tickets? (1-8): ").strip()
            qty = int(raw)
            if 1 <= qty <= 8:
                return qty
            print("Please enter a number between 1 and 8.")
        except ValueError:
            print("Please enter a valid number.")


def select_quantity(page, quantity):
    """Click the quantity filter on Ticketmaster and choose the desired amount."""
    print(f"Setting quantity to {quantity}...", file=sys.stderr)

    # Try several strategies since Ticketmaster's markup varies by view
    strategies = [
        # Strategy 1: native <select> element
        lambda: page.select_option(
            'select[aria-label*="quantity" i], select[name*="quantity" i], select[data-testid*="quantity" i]',
            str(quantity),
            timeout=5000,
        ),
        # Strategy 2: custom dropdown button + list option
        lambda: _click_custom_dropdown(page, quantity),
    ]

    for i, strategy in enumerate(strategies, 1):
        try:
            strategy()
            print(f"  Quantity selected via strategy {i}", file=sys.stderr)
            # Give the page a moment to refilter
            time.sleep(3)
            return True
        except Exception as e:
            print(f"  Strategy {i} failed: {str(e)[:80]}", file=sys.stderr)

    print("  WARNING: Could not set quantity — showing all prices instead", file=sys.stderr)
    return False


def _click_custom_dropdown(page, quantity):
    """Open a custom dropdown trigger and click the option matching the quantity."""
    triggers = [
        '[data-testid*="quantity"]',
        'button[aria-label*="quantity" i]',
        'button[aria-label*="Number of tickets" i]',
        '[class*="quantity" i] button',
        '[class*="Quantity" i] button',
    ]
    for sel in triggers:
        el = page.query_selector(sel)
        if el:
            el.click()
            time.sleep(1)
            # Find the option matching the quantity number
            option_selectors = [
                f'[role="option"]:has-text("{quantity}")',
                f'li:has-text("{quantity}")',
                f'button:has-text("{quantity}")',
            ]
            for opt_sel in option_selectors:
                try:
                    page.click(opt_sel, timeout=2000)
                    return
                except Exception:
                    continue
    raise Exception("No custom dropdown trigger found")


def scrape_prices(url, quantity):
    api_data = []

    def capture_response(response):
        resp_url = response.url
        if any(k in resp_url.lower() for k in [
            "offers", "inventory", "price", "quickpicks", "availability", "map", "shape"
        ]):
            try:
                api_data.append({"url": resp_url, "data": response.json()})
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

        context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        """)

        page = context.new_page()

        def route_handler(route):
            if route.request.resource_type in ["image", "font", "media"]:
                route.abort()
            else:
                route.continue_()
        page.route("**/*", route_handler)

        page.on("response", capture_response)

        print("Loading page...", file=sys.stderr)
        page.goto(url, wait_until="domcontentloaded", timeout=60000)

        print("Waiting for ticket list to load...", file=sys.stderr)
        try:
            page.wait_for_selector(
                '[data-testid*="quick-pick"], [data-testid*="ticket"], [class*="quick-pick"], [class*="QuickPicks"], [class*="ticketList"], [class*="TicketList"]',
                timeout=30000,
            )
            print("Ticket list detected!", file=sys.stderr)
        except Exception:
            print("Ticket list selector timed out — continuing anyway", file=sys.stderr)

        # Apply the quantity filter BEFORE scraping prices
        select_quantity(page, quantity)

        # Scroll to trigger lazy loading
        page.evaluate("window.scrollTo(0, document.body.scrollHeight / 2)")
        time.sleep(2)
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        time.sleep(3)
        page.evaluate("window.scrollTo(0, 0)")
        time.sleep(2)

        dom_data = page.evaluate("""
            () => {
                const result = { prices: [], ticketCards: [] };
                const allText = document.body.innerText || "";
                const matches = allText.match(/\\$[\\d,]+(?:\\.\\d{2})?/g) || [];
                result.prices = [...new Set(matches)];

                const cards = document.querySelectorAll('[data-testid*="quick-pick"], [data-testid*="ticket-card"], [class*="quick-pick"], [class*="QuickPick"], li[class*="ticket"]');
                cards.forEach(card => {
                    const text = (card.innerText || "").trim();
                    if (text) result.ticketCards.push(text);
                });
                return result;
            }
        """)

        html = page.content()
        browser.close()

    return {
        "url": url,
        "quantity": quantity,
        "dom_prices": dom_data["prices"],
        "ticket_cards": dom_data["ticketCards"],
        "api_responses_count": len(api_data),
        "api_responses": api_data,
        "html_length": len(html),
    }, html


if __name__ == "__main__":
    # Usage:
    #   python scraper.py <url> [quantity]           -> scrape a specific event URL
    #   python scraper.py --search <keyword>         -> search via Discovery API, pick event, scrape
    #   python scraper.py                            -> interactive: prompt for search keyword
    event_name = None
    if len(sys.argv) >= 2 and sys.argv[1] == "--search":
        if len(sys.argv) < 3:
            print("Usage: python scraper.py --search <keyword>")
            sys.exit(1)
        keyword = " ".join(sys.argv[2:])
        events = search_events(keyword, size=5)
        chosen = choose_event(events)
        url = chosen.get("url")
        event_name = chosen.get("name")
        print(f"\nSelected: {event_name}\n{url}\n", file=sys.stderr)
        quantity = prompt_for_quantity()
    elif len(sys.argv) >= 2 and sys.argv[1].startswith("http"):
        url = sys.argv[1]
        if len(sys.argv) >= 3:
            try:
                quantity = int(sys.argv[2])
                if not (1 <= quantity <= 8):
                    raise ValueError
            except ValueError:
                print("Quantity must be a number between 1 and 8")
                sys.exit(1)
        else:
            quantity = prompt_for_quantity()
    else:
        # No args: interactive search mode
        keyword = input("Search for an event: ").strip()
        if not keyword:
            print("No keyword entered. Exiting.")
            sys.exit(0)
        events = search_events(keyword, size=5)
        chosen = choose_event(events)
        url = chosen.get("url")
        event_name = chosen.get("name")
        print(f"\nSelected: {event_name}\n{url}\n", file=sys.stderr)
        quantity = prompt_for_quantity()

    result, html = scrape_prices(url, quantity)
    if event_name:
        result["event_name"] = event_name

    ts = int(time.time())
    json_file = f"prices_{quantity}tickets_{ts}.json"
    html_file = f"debug_{quantity}tickets_{ts}.html"

    with open(json_file, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)
    with open(html_file, "w", encoding="utf-8") as f:
        f.write(html)

    print(f"\nSaved price data to {json_file}", file=sys.stderr)
    print(f"Saved debug HTML to {html_file}", file=sys.stderr)
    print(f"\nResults for {quantity} ticket(s):")
    print(f"  {len(result['dom_prices'])} prices, {len(result['ticket_cards'])} ticket cards, {result['api_responses_count']} API responses")
    if result["dom_prices"]:
        print("\nPrices found:")
        for p in result["dom_prices"]:
            print(f"  {p}")

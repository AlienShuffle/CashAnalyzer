import requests
from bs4 import BeautifulSoup
import pandas as pd
import re
from urllib.parse import urljoin

BASE_URL = "https://www.crsp.org"
INDEX_PAGE = "https://www.crsp.org/indexes/#market-cap"

HEADERS = {
    "User-Agent": "Mozilla/5.0"
}

TARGET_DATE = "March 31, 2026"


# -----------------------------
# Step 1: Collect all sub-pages
# -----------------------------
def get_index_links():
    resp = requests.get(INDEX_PAGE, headers=HEADERS)
    soup = BeautifulSoup(resp.text, "html.parser")

    links = set()

    for a in soup.find_all("a", href=True):
        href = a["href"]

        # Capture only CRSP US index pages
        if href.startswith("/indexes/crsp-us"):
            full_url = urljoin(BASE_URL, href)
            links.add(full_url)

    return sorted(list(links))


# -----------------------------
# Step 2: Extract structured data
# -----------------------------
def extract_index_data(url):
    resp = requests.get(url, headers=HEADERS)
    soup = BeautifulSoup(resp.text, "html.parser")

    full_text = soup.get_text(separator="\n")

    # ✅ HARD FILTER: Only include March 31, 2026 snapshots
    if TARGET_DATE not in full_text:
        return None

    # --- Index Name ---
    h1 = soup.find("h1")
    index_name = h1.get_text(strip=True) if h1 else None

    # --- Extract fields via regex anchored to label text ---
    def extract(pattern):
        match = re.search(pattern, full_text)
        return match.group(1).strip() if match else None

    ticker = extract(r"Price Return Ticker\s*([A-Z0-9]+)")
    num_companies = extract(r"Number of Companies\s*([\d,]+)")
    market_cap = extract(r"Index Market Cap \(\$M\)\s*\$([\d,]+)")

    if not index_name or not ticker:
        return None

    return {
        "index_name": index_name,
        "price_ticker": ticker,
        "num_companies": num_companies,
        "market_cap_musd": market_cap,
        "as_of_date": TARGET_DATE,
        "source_url": url,
    }


# -----------------------------
# Step 3: Run scrape
# -----------------------------
def scrape_all():
    links = get_index_links()
    print(f"Discovered {len(links)} index pages")

    rows = []

    for link in links:
        print(f"Scraping {link}")
        try:
            data = extract_index_data(link)
            if data:
                rows.append(data)
            else:
                print(f"Skipped (no {TARGET_DATE} data): {link}")
        except Exception as e:
            print(f"Error: {link} -> {e}")

    df = pd.DataFrame(rows)

    if df.empty:
        print("WARNING: No matching data found for target date.")
        return df

    # -----------------------------
    # Step 4: Normalize dataset
    # -----------------------------
    df["num_companies"] = (
        df["num_companies"]
        .str.replace(",", "", regex=False)
        .astype("Int64")
    )

    df["market_cap_musd"] = (
        df["market_cap_musd"]
        .str.replace(",", "", regex=False)
        .astype("float")
    )

    # Add derived fields
    df["market_cap_busd"] = df["market_cap_musd"] / 1_000  # billions

    # Reorder nicely
    df = df[
        [
            "index_name",
            "price_ticker",
            "num_companies",
            "market_cap_musd",
            "market_cap_busd",
            "as_of_date",
            "source_url",
        ]
    ]

    # Sort by market cap descending
    df = df.sort_values(by="market_cap_musd", ascending=False)

    return df


# -----------------------------
# Step 5: Execute + Save
# -----------------------------
if __name__ == "__main__":
    df = scrape_all()

    print("\nFinal dataset:\n")
    print(df.to_string(index=False))

    df.to_csv("crsp_market_indexes_2026-03-31.csv", index=False)

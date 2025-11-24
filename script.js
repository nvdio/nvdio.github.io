const form = document.getElementById("ticker-form");
const statusEl = document.getElementById("status");
const resultsBody = document.getElementById("results-body");

const YAHOO_URL = (ticker) =>
  `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    ticker
  )}?range=1y&interval=1d`;

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const raw = new FormData(form).get("tickers")?.trim();

  if (!raw) {
    statusEl.textContent = "Please enter at least one ticker.";
    return;
  }

  const tickers = raw
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);

  if (!tickers.length) {
    statusEl.textContent = "Please provide valid ticker symbols.";
    return;
  }

  statusEl.textContent = "Fetching data from Yahoo Finance...";
  resultsBody.innerHTML = "";

  const rows = await Promise.all(tickers.map(fetchTickerSummary));
  const successful = rows.filter(Boolean);

  if (!successful.length) {
    resultsBody.innerHTML = `<tr class="placeholder"><td colspan="8">No data returned. Please check the tickers and try again.</td></tr>`;
  } else {
    successful.forEach((row) => resultsBody.appendChild(row));
  }

  statusEl.textContent = `Data fetch complete. ${successful.length} of ${tickers.length} tickers processed successfully.`;
});

async function fetchTickerSummary(ticker) {
  try {
    const response = await fetch(YAHOO_URL(ticker));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const result = data.chart?.result?.[0];
    if (!result) throw new Error("No chart data returned");

    const meta = result.meta;
    const indicators = result.indicators;
    const quote = indicators?.quote?.[0];
    const timestamps = result.timestamp;

    const lows = quote?.low || [];
    const highs = quote?.high || [];
    const price = Number(meta?.regularMarketPrice);

    if (!price || !Array.isArray(lows) || !Array.isArray(highs)) {
      throw new Error("Missing pricing fields");
    }

    const { value: minLow, index: lowIndex } = findExtreme(lows, Math.min);
    const { value: maxHigh, index: highIndex } = findExtreme(highs, Math.max);

    if (minLow === null || maxHigh === null) throw new Error("No candle data");

    const lowDate = formatDate(timestamps?.[lowIndex]);
    const highDate = formatDate(timestamps?.[highIndex]);

    const distLow = minLow > 0 ? (price - minLow) / minLow : 0;
    const distHigh = maxHigh !== 0 ? (price - maxHigh) / maxHigh : 0;
    const pctLow = minLow > 0 ? price / minLow - 1 : 0;

    return createRow({
      ticker,
      price,
      low: minLow,
      high: maxHigh,
      lowDate,
      highDate,
      distLow,
      distHigh,
      pctLow,
    });
  } catch (error) {
    console.error(`Failed to fetch ${ticker}:`, error);
    return createErrorRow(ticker, error.message);
  }
}

function findExtreme(values, comparator) {
  let extreme = null;
  let index = -1;

  values.forEach((value, i) => {
    if (value === null || value === undefined) return;
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return;

    if (extreme === null) {
      extreme = numeric;
      index = i;
      return;
    }

    if (comparator(numeric, extreme) === numeric) {
      extreme = numeric;
      index = i;
    }
  });

  return { value: extreme, index };
}

function formatDate(unixSeconds) {
  if (!unixSeconds) return "";
  const date = new Date(unixSeconds * 1000);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function createRow({ ticker, price, low, high, lowDate, highDate, distLow, distHigh, pctLow }) {
  const row = document.createElement("tr");

  row.innerHTML = `
    <td><span class="badge">${ticker}</span></td>
    <td>${new Date().toLocaleString()}</td>
    <td>${price.toFixed(2)}</td>
    <td>${low.toFixed(2)} <span class="muted">(${lowDate || "n/a"})</span></td>
    <td>${high.toFixed(2)} <span class="muted">(${highDate || "n/a"})</span></td>
    <td>${(distLow * 100).toFixed(2)}%</td>
    <td>${(distHigh * 100).toFixed(2)}%</td>
    <td>${(pctLow * 100).toFixed(2)}%</td>
  `;

  return row;
}

function createErrorRow(ticker, message) {
  const row = document.createElement("tr");
  row.innerHTML = `
    <td><span class="badge badge--error">${ticker}</span></td>
    <td colspan="7">${message}</td>
  `;
  return row;
}

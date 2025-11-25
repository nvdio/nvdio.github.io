// script.js – Marketstack version using key: e8180173173e050f0192a4bd1a404563

document.addEventListener('DOMContentLoaded', function () {
    const tickerInput    = document.getElementById('tickerInput');
    const fetchButton    = document.getElementById('fetchButton');
    const tableBody      = document.getElementById('tableBody');
    const statusMessage  = document.getElementById('statusMessage');
    const lastUpdated    = document.getElementById('lastUpdated');
    const tickerExamples = document.querySelectorAll('.ticker-example');

    // Marketstack API
    const API_KEY   = 'e8180173173e050f0192a4bd1a404563';
    const BASE_URL  = 'http://api.marketstack.com/v1/eod';
    const PROXY_URL = 'https://api.allorigins.win/raw?url='; 
    // Note: Marketstack free plan is HTTP-only; we use a proxy to avoid
    // mixed-content and CORS issues when your site is served over HTTPS.

    // Fill input when clicking examples
    tickerExamples.forEach(example => {
        example.addEventListener('click', function () {
            tickerInput.value = this.getAttribute('data-tickers');
        });
    });

    // Fetch button
    fetchButton.addEventListener('click', fetchStockData);

    // Enter key
    tickerInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            fetchStockData();
        }
    });

    async function fetchStockData() {
        const tickers = tickerInput.value.trim();

        if (!tickers) {
            showStatus('Please enter at least one stock ticker.', 'error');
            return;
        }

        // Reset table/status
        tableBody.innerHTML = '';
        showStatus('Fetching stock data...', 'info');
        fetchButton.disabled = true;
        fetchButton.innerHTML = '<div class="loading"></div> Fetching...';

        const tickerArray = tickers.split(',')
            .map(t => t.trim())
            .filter(t => t !== '');

        let successCount = 0;

        for (const ticker of tickerArray) {
            try {
                const stockData = await getStockData(ticker);
                if (stockData && stockData.currentPrice != null) {
                    addRowToTable(ticker, stockData);
                    successCount++;
                } else {
                    addErrorRow(ticker, 'No data');
                }
            } catch (err) {
                console.error(`Error fetching data for ${ticker}:`, err);
                addErrorRow(ticker, 'API Error');
            }
        }

        if (successCount > 0) {
            showStatus(
                `Data fetch complete. ${successCount} of ${tickerArray.length} tickers processed successfully.`,
                'success'
            );
        } else {
            showStatus(
                'Failed to fetch data for any tickers. Please check your symbols.',
                'error'
            );
        }

        const now = new Date();
        if (lastUpdated) {
            lastUpdated.textContent = `Last updated: ${now.toLocaleString()}`;
        }

        fetchButton.disabled = false;
        fetchButton.innerHTML = '<i class="fas fa-download"></i> Fetch Stock Data';
    }

    async function getStockData(ticker) {
        // Request up to ~1 year of daily EOD data
        const apiUrl = `${BASE_URL}?access_key=${API_KEY}` +
            `&symbols=${encodeURIComponent(ticker)}` +
            `&limit=365&sort=DESC`;

        const url = PROXY_URL + encodeURIComponent(apiUrl);

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (!data || !Array.isArray(data.data) || data.data.length === 0) {
            throw new Error('No data returned from Marketstack');
        }

        const eodData = data.data
            .filter(d => d && d.close != null && d.high != null && d.low != null);

        if (eodData.length === 0) {
            throw new Error('Missing price fields for symbol: ' + ticker);
        }

        // Current price: latest close (results are sorted DESC by date)
        const latest = eodData[0];
        const currentPrice = parseFloat(latest.close);

        // 52-week (approx) high/low from available EOD data
        const lows  = eodData.map(d => parseFloat(d.low));
        const highs = eodData.map(d => parseFloat(d.high));

        const weekLow52  = Math.min(...lows);
        const weekHigh52 = Math.max(...highs);

        // Dates for 52-week low/high
        const lowPoint  = eodData.find(d => parseFloat(d.low)  === weekLow52)  || latest;
        const highPoint = eodData.find(d => parseFloat(d.high) === weekHigh52) || latest;

        const lowDate  = new Date(lowPoint.date);
        const highDate = new Date(highPoint.date);

        return {
            currentPrice,
            weekLow52,
            weekHigh52,
            lowDate,
            highDate
        };
    }

    function addRowToTable(ticker, data) {
        const row = document.createElement('tr');

        const distanceFromLow  = data.weekLow52  > 0
            ? (data.currentPrice - data.weekLow52) / data.weekLow52
            : null;
        const distanceFromHigh = data.weekHigh52 > 0
            ? (data.currentPrice - data.weekHigh52) / data.weekHigh52
            : null;
        const percentageToLow  = data.weekLow52  > 0
            ? (data.currentPrice / data.weekLow52) - 1
            : null;

        const formatCurrency = (value) =>
            value != null ? `$${value.toFixed(2)}` : 'N/A';

        const formatPercent = (value) => {
            if (value == null) return 'N/A';
            const className = value >= 0 ? 'positive' : 'negative';
            return `<span class="${className}">${(value * 100).toFixed(2)}%</span>`;
        };

        const formatDate = (date) =>
            date instanceof Date && !isNaN(date) ? date.toLocaleDateString() : 'N/A';

        const formatNumber = (value) =>
            value != null ? value.toFixed(4) : 'N/A';

        row.innerHTML = `
            <td><strong>${ticker}</strong></td>
            <td>${formatCurrency(data.currentPrice)}</td>
            <td>${formatCurrency(data.weekLow52)}</td>
            <td>${formatCurrency(data.weekHigh52)}</td>
            <td>${formatNumber(distanceFromLow)}</td>
            <td>${formatNumber(distanceFromHigh)}</td>
            <td>${formatPercent(percentageToLow)}</td>
            <td>${formatDate(data.lowDate)}</td>
            <td>${formatDate(data.highDate)}</td>
        `;

        tableBody.appendChild(row);
    }

    function addErrorRow(ticker, errorType = 'Error') {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${ticker}</strong></td>
            <td class="error-cell">${errorType}</td>
            <td class="error-cell">${errorType}</td>
            <td class="error-cell">${errorType}</td>
            <td class="error-cell">${errorType}</td>
            <td class="error-cell">${errorType}</td>
            <td class="error-cell">${errorType}</td>
            <td class="error-cell">${errorType}</td>
            <td class="error-cell">${errorType}</td>
        `;
        tableBody.appendChild(row);
    }

    function showStatus(message, type) {
        if (!statusMessage) return;
        statusMessage.textContent = message;
        statusMessage.className = 'status ' + type;
    }
});


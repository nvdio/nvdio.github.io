document.addEventListener('DOMContentLoaded', function() {
    const tickerInput = document.getElementById('tickerInput');
    const fetchButton = document.getElementById('fetchButton');
    const tableBody = document.getElementById('tableBody');
    const statusMessage = document.getElementById('statusMessage');
    const lastUpdated = document.getElementById('lastUpdated');
    const tickerExamples = document.querySelectorAll('.ticker-example');
    const rateLimitProgress = document.getElementById('rateLimitProgress');
    
    // Alpha Vantage API Key
    const API_KEY = 'ZGNV8YBI0VDVBKHT';
    
    // Rate limiting variables
    let requestCount = 0;
    let lastResetTime = Date.now();
    const REQUESTS_PER_MINUTE = 5;

    // Add event listeners to example tickers
    tickerExamples.forEach(example => {
        example.addEventListener('click', function() {
            tickerInput.value = this.getAttribute('data-tickers');
        });
    });

    // Fetch stock data when button is clicked
    fetchButton.addEventListener('click', fetchStockData);

    // Allow pressing Enter to fetch data
    tickerInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            fetchStockData();
        }
    });

    // Update rate limit display
    function updateRateLimitDisplay() {
        const now = Date.now();
        const timeSinceReset = now - lastResetTime;
        
        // Reset counter if more than a minute has passed
        if (timeSinceReset > 60000) {
            requestCount = 0;
            lastResetTime = now;
        }
        
        const percentage = (requestCount / REQUESTS_PER_MINUTE) * 100;
        rateLimitProgress.style.width = `${percentage}%`;
        
        // Change color based on usage
        if (percentage >= 80) {
            rateLimitProgress.style.background = 'linear-gradient(90deg, #dc3545, #ff6b6b)';
        } else if (percentage >= 60) {
            rateLimitProgress.style.background = 'linear-gradient(90deg, #ffc107, #ffd54f)';
        } else {
            rateLimitProgress.style.background = 'linear-gradient(90deg, #28a745, #0077ff)';
        }
    }

    async function fetchStockData() {
        const tickers = tickerInput.value.trim();
        
        if (!tickers) {
            showStatus('Please enter at least one stock ticker.', 'error');
            return;
        }

        // Check rate limit
        if (requestCount >= REQUESTS_PER_MINUTE) {
            showStatus('Rate limit exceeded. Please wait a minute before making more requests.', 'error');
            return;
        }

        // Clear previous data
        tableBody.innerHTML = '';
        showStatus('Fetching stock data...', 'info');
        fetchButton.disabled = true;
        fetchButton.innerHTML = '<div class="loading"></div> Fetching...';

        const tickerArray = tickers.split(',').map(t => t.trim()).filter(t => t !== '');
        let successCount = 0;

        // Process each ticker
        for (const ticker of tickerArray) {
            try {
                // Check rate limit before each request
                if (requestCount >= REQUESTS_PER_MINUTE) {
                    showStatus('Rate limit reached. Some data may be incomplete.', 'warning');
                    break;
                }

                const stockData = await getStockData(ticker);
                if (stockData && stockData.currentPrice) {
                    addRowToTable(ticker, stockData);
                    successCount++;
                } else {
                    addErrorRow(ticker, 'No data');
                }
                
                // Increment request count
                requestCount++;
                updateRateLimitDisplay();
                
                // Add small delay between requests to be respectful to API
                await new Promise(resolve => setTimeout(resolve, 200));
            } catch (error) {
                console.error(`Error fetching data for ${ticker}:`, error);
                addErrorRow(ticker, 'API Error');
            }
        }

        // Update status
        if (successCount > 0) {
            showStatus(`Data fetch complete. ${successCount} of ${tickerArray.length} tickers processed successfully.`, 'success');
        } else {
            showStatus('Failed to fetch data for any tickers. Please check your symbols.', 'error');
        }

        // Update last updated time
        const now = new Date();
        lastUpdated.textContent = `Last updated: ${now.toLocaleString()}`;

        // Re-enable button
        fetchButton.disabled = false;
        fetchButton.innerHTML = '<i class="fas fa-download"></i> Fetch Stock Data';
    }

    async function getStockData(ticker) {
        const apiUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${ticker}&apikey=${API_KEY}&outputsize=full`;
        
        try {
            const response = await fetch(apiUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Check for API error messages
            if (data['Error Message']) {
                throw new Error('Invalid symbol: ' + ticker);
            }
            
            if (data['Note']) {
                throw new Error('API limit reached');
            }
            
            const timeSeries = data['Time Series (Daily)'];
            if (!timeSeries) {
                throw new Error('No data available for symbol: ' + ticker);
            }
            
            // Get all dates and sort them
            const dates = Object.keys(timeSeries).sort();
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            
            // Filter data from the last year
            const recentData = dates.filter(date => new Date(date) >= oneYearAgo);
            
            if (recentData.length === 0) {
                throw new Error('Insufficient historical data for symbol: ' + ticker);
            }
            
            // Extract prices
            const prices = recentData.map(date => ({
                date: date,
                high: parseFloat(timeSeries[date]['2. high']),
                low: parseFloat(timeSeries[date]['3. low']),
                close: parseFloat(timeSeries[date]['4. close'])
            }));
            
            // Calculate 52-week high/low
            const weekLow52 = Math.min(...prices.map(p => p.low));
            const weekHigh52 = Math.max(...prices.map(p => p.high));
            
            // Find dates for highs/lows
            const lowData = prices.find(p => p.low === weekLow52);
            const highData = prices.find(p => p.high === weekHigh52);
            
            // Current price is the latest close
            const currentPrice = prices[prices.length - 1].close;
            
            return {
                currentPrice,
                weekLow52,
                weekHigh52,
                lowDate: new Date(lowData.date),
                highDate: new Date(highData.date)
            };
            
        } catch (error) {
            console.error(`Error fetching data for ${ticker}:`, error);
            throw error;
        }
    }

    function addRowToTable(ticker, data) {
        const row = document.createElement('tr');
        
        // Calculate derived values
        const distanceFromLow = data.weekLow52 > 0 ? (data.currentPrice - data.weekLow52) / data.weekLow52 : null;
        const distanceFromHigh = data.weekHigh52 > 0 ? (data.currentPrice - data.weekHigh52) / data.weekHigh52 : null;
        const percentageToLow = data.weekLow52 > 0 ? (data.currentPrice / data.weekLow52) - 1 : null;
        
        // Format values
        const formatCurrency = (value) => {
            return value !== null ? `$${value.toFixed(2)}` : 'N/A';
        };
        
        const formatPercent = (value) => {
            if (value === null) return 'N/A';
            const className = value >= 0 ? 'positive' : 'negative';
            return `<span class="${className}">${(value * 100).toFixed(2)}%</span>`;
        };
        
        const formatDate = (date) => {
            return date.toLocaleDateString();
        };
        
        const formatNumber = (value) => {
            return value !== null ? value.toFixed(4) : 'N/A';
        };
        
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
        statusMessage.textContent = message;
        statusMessage.className = 'status ' + type;
        
        // Auto-hide success messages after 5 seconds
        if (type === 'success') {
            setTimeout(() => {
                statusMessage.style.display = 'none';
            }, 5000);
        }
    }

    // Initialize rate limit display
    updateRateLimitDisplay();
});

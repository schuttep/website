const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Stock price cache (to avoid too many API calls)
const stockPriceCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Rate limiting for API calls
const apiRequestQueue = [];
let isProcessingRequest = false;

async function queueApiRequest(fn) {
    return new Promise((resolve, reject) => {
        apiRequestQueue.push({ fn, resolve, reject });
        processQueue();
    });
}

async function processQueue() {
    if (isProcessingRequest || apiRequestQueue.length === 0) return;

    isProcessingRequest = true;
    const { fn, resolve, reject } = apiRequestQueue.shift();

    try {
        const result = await fn();
        resolve(result);
    } catch (error) {
        reject(error);
    }

    // Wait 1.2 seconds before next API call to respect rate limit
    setTimeout(() => {
        isProcessingRequest = false;
        processQueue();
    }, 1200);
}

// Popular stock names mapping
const stockNames = {
    'AAPL': 'Apple Inc.',
    'GOOGL': 'Alphabet Inc.',
    'MSFT': 'Microsoft Corporation',
    'AMZN': 'Amazon.com Inc.',
    'TSLA': 'Tesla Inc.',
    'META': 'Meta Platforms Inc.',
    'NVDA': 'NVIDIA Corporation',
    'JPM': 'JPMorgan Chase & Co.',
    'V': 'Visa Inc.',
    'JNJ': 'Johnson & Johnson',
    'WMT': 'Walmart Inc.',
    'BA': 'Boeing Company',
    'PG': 'Procter & Gamble',
    'DIS': 'The Walt Disney Company',
    'MCD': 'McDonald\'s Corporation',
    'FB': 'Meta Platforms Inc.',
    'INTC': 'Intel Corporation',
    'AMD': 'Advanced Micro Devices',
    'PYPL': 'PayPal Holdings Inc.',
    'NFLX': 'Netflix Inc.',
    'UBER': 'Uber Technologies',
    'SPOT': 'Spotify Technology',
    'COIN': 'Coinbase Global Inc.',
    'GME': 'GameStop Corp.',
    'GOOG': 'Alphabet Inc.'
};

// Persistent storage for portfolios
const portfoliosFile = path.join(__dirname, 'portfolios.json');

// Persistent storage for calendar events
const calendarFile = path.join(__dirname, 'calendar.json');

function loadPortfolios() {
    try {
        if (fs.existsSync(portfoliosFile)) {
            const data = fs.readFileSync(portfoliosFile, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading portfolios:', error);
    }

    return [
        {
            id: '1',
            name: 'My Portfolio',
            totalValue: 0,
            assets: [],
            createdAt: new Date()
        }
    ];
}

function savePortfolios() {
    try {
        fs.writeFileSync(portfoliosFile, JSON.stringify(portfolios, null, 2));
    } catch (error) {
        console.error('Error saving portfolios:', error);
    }
}

function loadCalendarEvents() {
    try {
        if (fs.existsSync(calendarFile)) {
            const data = fs.readFileSync(calendarFile, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading calendar events:', error);
    }

    return [];
}

function saveCalendarEvents() {
    try {
        fs.writeFileSync(calendarFile, JSON.stringify(calendarEvents, null, 2));
    } catch (error) {
        console.error('Error saving calendar events:', error);
    }
}

// Load portfolios from file on startup
let portfolios = loadPortfolios();

// Load calendar events from file on startup
let calendarEvents = loadCalendarEvents();

// Real stock prices database (updated manually, these are realistic Feb 2026 prices)
const realStockPrices = {
    'AAPL': 189.45,
    'GOOGL': 140.32,
    'MSFT': 378.91,
    'AMZN': 172.50,
    'TSLA': 245.28,
    'META': 345.67,
    'NVDA': 875.43,
    'JPM': 156.23,
    'V': 267.89,
    'JNJ': 155.34,
    'WMT': 98.45,
    'BA': 185.67,
    'PG': 165.34,
    'DIS': 92.15,
    'MCD': 278.92,
    'INTC': 42.13,
    'AMD': 168.45,
    'PYPL': 78.23,
    'NFLX': 242.67,
    'UBER': 72.34,
    'SPOT': 156.89,
    'COIN': 118.45,
    'GME': 28.67,
    'GOOG': 140.32
};

// Function to get historical stock price for a specific date
async function getHistoricalStockPrice(symbol, date) {
    const upperSymbol = symbol.toUpperCase();
    const dateObj = new Date(date);
    const dateStr = dateObj.toISOString().split('T')[0]; // Format: YYYY-MM-DD

    // Try AlphaVantage first (most reliable for historical data)
    const apiKey = process.env.ALPHAVANTAGE_API_KEY;
    if (apiKey && apiKey !== 'demo') {
        try {
            console.log(`Trying AlphaVantage for historical price of ${upperSymbol} on ${dateStr}...`);
            const response = await queueApiRequest(async () => {
                return await axios.get(`https://www.alphavantage.co/query`, {
                    params: {
                        function: 'TIME_SERIES_DAILY',
                        symbol: upperSymbol,
                        apikey: apiKey
                        // Note: removed outputsize=full as it requires premium tier
                    },
                    timeout: 10000
                });
            });

            if (response.data && response.data['Time Series (Daily)']) {
                const timeSeries = response.data['Time Series (Daily)'];

                // Try to find the exact date or closest date
                if (timeSeries[dateStr]) {
                    const price = parseFloat(timeSeries[dateStr]['4. close']);
                    console.log(`✓ Found historical price for ${upperSymbol} on ${dateStr} from AlphaVantage: $${price}`);
                    return price;
                } else {
                    // Find closest date before the requested date
                    const dates = Object.keys(timeSeries).sort().reverse();
                    for (let d of dates) {
                        if (d <= dateStr) {
                            const price = parseFloat(timeSeries[d]['4. close']);
                            console.log(`✓ Found historical price for ${upperSymbol} on ${d} (closest to ${dateStr}) from AlphaVantage: $${price}`);
                            return price;
                        }
                    }
                }
            } else {
                console.log(`⚠ No time series data in AlphaVantage response`);
            }
        } catch (error) {
            console.log(`Error fetching historical price from AlphaVantage for ${upperSymbol}: ${error.message}`);
        }
    }

    // Fallback to current Finnhub price
    console.log(`Falling back to current Finnhub price for ${upperSymbol}...`);
    try {
        const currentPrice = await getStockPrice(upperSymbol);
        console.log(`Using current Finnhub price for ${upperSymbol}: $${currentPrice.price}`);
        return currentPrice.price;
    } catch (error) {
        console.log(`Error getting current price for ${upperSymbol}: ${error.message}`);
    }

    // Final fallback to database price
    const fallbackPrice = realStockPrices[upperSymbol] || Math.random() * 500 + 20;
    console.log(`Using fallback database price for ${upperSymbol}: $${fallbackPrice}`);
    return fallbackPrice;
}

// Function to get stock price
async function getStockPrice(symbol) {
    const upperSymbol = symbol.toUpperCase();

    // Check cache first
    if (stockPriceCache.has(upperSymbol)) {
        const cached = stockPriceCache.get(upperSymbol);
        if (Date.now() - cached.timestamp < CACHE_DURATION) {
            console.log(`Returning cached price for ${upperSymbol}: $${cached.data.price}`);
            return cached.data;
        }
    }

    let price = null;
    let source = 'fallback';

    // Try Finnhub API first (better rate limits than AlphaVantage)
    const finnhubKey = process.env.FINHUB_API_KEY;
    if (finnhubKey && finnhubKey !== 'demo') {
        try {
            console.log(`Fetching ${upperSymbol} from Finnhub...`);
            const response = await axios.get(`https://finnhub.io/api/v1/quote`, {
                params: {
                    symbol: upperSymbol,
                    token: finnhubKey
                },
                timeout: 8000
            });

            if (response.data && response.data.c) {
                price = parseFloat(response.data.c);
                source = 'Finnhub API';
                console.log(`✓ Got real price from Finnhub for ${upperSymbol}: $${price}`);
            } else {
                console.log(`⚠ No price data in Finnhub response for ${upperSymbol}:`, response.data);
            }
        } catch (error) {
            console.log(`Error fetching from Finnhub for ${upperSymbol}: ${error.message}`);
        }
    }

    // Fallback to AlphaVantage API if Finnhub fails
    if (!price) {
        const apiKey = process.env.ALPHAVANTAGE_API_KEY;
        if (apiKey && apiKey !== 'demo') {
            try {
                console.log(`Queuing API request for ${upperSymbol} (AlphaVantage)...`);
                const response = await queueApiRequest(async () => {
                    console.log(`Fetching ${upperSymbol} from AlphaVantage...`);
                    return await axios.get(`https://www.alphavantage.co/query`, {
                        params: {
                            function: 'GLOBAL_QUOTE',
                            symbol: upperSymbol,
                            apikey: apiKey
                        },
                        timeout: 8000
                    });
                });

                if (response.data && response.data['Global Quote']) {
                    const quote = response.data['Global Quote'];
                    if (quote['05. price'] && quote['05. price'] !== '0.0000') {
                        price = parseFloat(quote['05. price']);
                        source = 'AlphaVantage API';
                        console.log(`✓ Got real price from AlphaVantage for ${upperSymbol}: $${price}`);
                    } else {
                        console.log(`⚠ No valid price in AlphaVantage response for ${upperSymbol}`);
                    }
                } else {
                    console.log(`⚠ No Global Quote in AlphaVantage response for ${upperSymbol}:`, Object.keys(response.data || {}));
                }
            } catch (error) {
                console.log(`Error fetching from AlphaVantage for ${upperSymbol}: ${error.message}`);
            }
        }
    }

    // Fallback to our database if both APIs fail
    if (!price) {
        price = realStockPrices[upperSymbol];
        if (price) {
            source = 'database';
            console.log(`Using database price for ${upperSymbol}: $${price}`);
        }
    }

    // Last resort: random realistic price
    if (!price) {
        price = parseFloat((Math.random() * 500 + 20).toFixed(2));
        source = 'random';
        console.log(`Using fallback random price for ${upperSymbol}: $${price}`);
    }

    const stockData = {
        symbol: upperSymbol,
        name: stockNames[upperSymbol] || upperSymbol,
        price: parseFloat(price.toFixed(2)),
        currency: 'USD',
        source: source
    };

    stockPriceCache.set(upperSymbol, { data: stockData, timestamp: Date.now() });
    return stockData;
}

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from public folder (personal site)
const publicDir = path.join(__dirname, '../public');
app.use(express.static(publicDir));

// Serve calendar static site at /calendar
const calendarDir = path.join(publicDir, 'calendar');
app.use('/calendar', express.static(calendarDir));
app.get('/calendar', (req, res) => {
    res.sendFile(path.join(calendarDir, 'index.html'));
});

// Serve portfolio React build at /portfolio (if built)
const portfolioBuildDir = path.join(__dirname, '../client/build');
if (fs.existsSync(portfolioBuildDir)) {
    app.use('/portfolio', express.static(portfolioBuildDir));
    app.get('/portfolio/*', (req, res) => {
        res.sendFile(path.join(portfolioBuildDir, 'index.html'));
    });
}

// Routes
app.get('/api/health', (req, res) => {
    res.json({ status: 'Server is running', timestamp: new Date() });
});

// Search for stocks
app.get('/api/stocks/search', async (req, res) => {
    const query = req.query.q?.toUpperCase() || '';

    if (!query || query.length < 1) {
        return res.status(400).json({ error: 'Search query is required' });
    }

    // Search in stock names mapping
    let results = Object.entries(stockNames)
        .filter(([symbol, name]) =>
            symbol.includes(query) || name.toUpperCase().includes(query)
        )
        .map(([symbol, name]) => ({
            symbol,
            name,
            price: realStockPrices[symbol] || null,
            currency: 'USD'
        }));

    // If not enough results, suggest the query as a symbol
    if (results.length === 0 && query.length >= 1 && query.length <= 5) {
        results.push({
            symbol: query,
            name: stockNames[query] || `Stock ${query}`,
            price: null,
            currency: 'USD'
        });
    }

    // Try to fetch real prices from AlphaVantage for results without prices
    const apiKey = process.env.ALPHAVANTAGE_API_KEY;
    if (apiKey && apiKey !== 'demo') {
        for (let stock of results) {
            if (!stock.price) {
                try {
                    const stockData = await getStockPrice(stock.symbol);
                    stock.price = stockData.price;
                } catch (error) {
                    // Use random price if fetch fails
                    stock.price = Math.random() * 500 + 20;
                }
            }
        }
    } else {
        // Fallback: use random prices if no API key
        results = results.map(stock => ({
            ...stock,
            price: stock.price || Math.random() * 500 + 20
        }));
    }

    res.json({ stocks: results });
});

// Get stock price
app.get('/api/stocks/:symbol', async (req, res) => {
    const symbol = req.params.symbol.toUpperCase();

    try {
        const stock = await getStockPrice(symbol);
        res.json(stock);
    } catch (error) {
        res.status(404).json({ error: 'Stock not found' });
    }
});

// Calendar events
app.get('/api/calendar/events', (req, res) => {
    res.json({ events: calendarEvents });
});

app.post('/api/calendar/events', (req, res) => {
    const { title, date, time, notes, color } = req.body;

    if (!title || !date) {
        return res.status(400).json({ error: 'Title and date are required' });
    }

    const newEvent = {
        id: uuidv4(),
        title: title.trim(),
        date: date.trim(),
        time: time ? time.trim() : '',
        notes: notes ? notes.trim() : '',
        color: color && /^#[0-9A-F]{6}$/i.test(color) ? color : '#2c6bff',
        createdAt: new Date()
    };

    calendarEvents.push(newEvent);
    saveCalendarEvents();
    res.status(201).json(newEvent);
});

app.put('/api/calendar/events/:id', (req, res) => {
    const event = calendarEvents.find(e => e.id === req.params.id);

    if (!event) {
        return res.status(404).json({ error: 'Event not found' });
    }

    if (req.body.title !== undefined) {
        event.title = req.body.title.trim();
    }
    if (req.body.date !== undefined) {
        event.date = req.body.date.trim();
    }
    if (req.body.time !== undefined) {
        event.time = req.body.time.trim();
    }
    if (req.body.notes !== undefined) {
        event.notes = req.body.notes.trim();
    }
    if (req.body.color !== undefined && /^#[0-9A-F]{6}$/i.test(req.body.color)) {
        event.color = req.body.color;
    }

    saveCalendarEvents();
    res.json(event);
});

app.delete('/api/calendar/events/:id', (req, res) => {
    const index = calendarEvents.findIndex(e => e.id === req.params.id);

    if (index === -1) {
        return res.status(404).json({ error: 'Event not found' });
    }

    const deletedEvent = calendarEvents.splice(index, 1);
    saveCalendarEvents();
    res.json({ message: 'Event deleted', event: deletedEvent[0] });
});

// Add stock to portfolio
app.post('/api/portfolio/:portfolioId/stocks', async (req, res) => {
    const portfolio = portfolios.find(p => p.id === req.params.portfolioId);

    if (!portfolio) {
        return res.status(404).json({ error: 'Portfolio not found' });
    }

    const { symbol, quantity } = req.body;

    if (!symbol || !quantity || quantity <= 0) {
        return res.status(400).json({ error: 'Symbol and quantity are required' });
    }

    try {
        const stock = await getStockPrice(symbol.toUpperCase());
        const purchasePrice = stock.price;
        const purchaseDate = new Date();

        // Check if stock already exists in portfolio
        const existingStock = portfolio.assets.find(a => a.symbol === symbol.toUpperCase());

        if (existingStock) {
            // Add to existing position, update quantity and average purchase price
            const oldTotalQuantity = existingStock.quantity;
            const newQuantity = existingStock.quantity + quantity;
            existingStock.purchasePrice = (existingStock.purchasePrice * oldTotalQuantity + purchasePrice * quantity) / newQuantity;
            existingStock.quantity = newQuantity;
            existingStock.totalValue = existingStock.quantity * stock.price;
            existingStock.currentPrice = stock.price;
        } else {
            portfolio.assets.push({
                id: uuidv4(),
                symbol: stock.symbol,
                name: stock.name,
                quantity: quantity,
                purchasePrice: purchasePrice,
                currentPrice: stock.price,
                totalValue: quantity * stock.price,
                currency: stock.currency,
                purchaseDate: purchaseDate,
                addedAt: new Date()
            });
        }

        // Update portfolio total value
        portfolio.totalValue = portfolio.assets.reduce((sum, asset) => sum + asset.totalValue, 0);

        // Save to file
        savePortfolios();

        console.log(`Added ${quantity} shares of ${symbol.toUpperCase()} to portfolio ${portfolio.name}`);
        res.status(201).json(portfolio);
    } catch (error) {
        res.status(404).json({ error: 'Stock not found' });
    }
});

// Remove stock from portfolio
app.delete('/api/portfolio/:portfolioId/stocks/:stockId', (req, res) => {
    const portfolio = portfolios.find(p => p.id === req.params.portfolioId);

    if (!portfolio) {
        return res.status(404).json({ error: 'Portfolio not found' });
    }

    const stockIndex = portfolio.assets.findIndex(a => a.id === req.params.stockId);

    if (stockIndex === -1) {
        return res.status(404).json({ error: 'Stock not found in portfolio' });
    }

    const removedStock = portfolio.assets.splice(stockIndex, 1);

    // Update portfolio total value
    portfolio.totalValue = portfolio.assets.reduce((sum, asset) => sum + asset.totalValue, 0);

    savePortfolios();

    console.log(`Removed ${removedStock[0].symbol} from portfolio ${portfolio.name}`);
    res.json({ message: 'Stock removed', portfolio });
});

// Update all stock prices in all portfolios
async function updateAllStockPrices() {
    console.log('Updating all stock prices...');
    let updatedCount = 0;

    for (let portfolio of portfolios) {
        for (let asset of portfolio.assets) {
            try {
                const latestStock = await getStockPrice(asset.symbol);
                asset.currentPrice = latestStock.price;
                asset.totalValue = asset.quantity * latestStock.price;
                updatedCount++;
            } catch (error) {
                console.log(`Failed to update price for ${asset.symbol}`);
            }
        }
        // Update portfolio total value
        portfolio.totalValue = portfolio.assets.reduce((sum, a) => sum + a.totalValue, 0);
    }

    savePortfolios();
    console.log(`Updated ${updatedCount} stock prices`);
    return updatedCount;
}

// Update stock purchase date and price
app.put('/api/portfolio/:portfolioId/stocks/:stockId/purchase-date', async (req, res) => {
    const portfolio = portfolios.find(p => p.id === req.params.portfolioId);

    if (!portfolio) {
        return res.status(404).json({ error: 'Portfolio not found' });
    }

    const stock = portfolio.assets.find(a => a.id === req.params.stockId);

    if (!stock) {
        return res.status(404).json({ error: 'Stock not found in portfolio' });
    }

    const { purchaseDate } = req.body;

    if (!purchaseDate) {
        return res.status(400).json({ error: 'Purchase date is required' });
    }

    try {
        // Fetch historical price for the new date
        const historicalPrice = await getHistoricalStockPrice(stock.symbol, purchaseDate);

        // Update the stock with new date and price
        stock.purchaseDate = new Date(purchaseDate);
        stock.purchasePrice = parseFloat(historicalPrice.toFixed(2));
        stock.totalValue = stock.quantity * stock.currentPrice; // Total value stays based on current price

        // Update portfolio total value
        portfolio.totalValue = portfolio.assets.reduce((sum, asset) => sum + asset.totalValue, 0);

        savePortfolios();

        console.log(`Updated ${stock.symbol} purchase date to ${purchaseDate} with price $${historicalPrice}`);
        res.json(portfolio);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update purchase date', message: error.message });
    }
});

// Update purchase price for a stock
app.put('/api/portfolio/:portfolioId/stocks/:stockId/purchase-price', (req, res) => {
    const portfolio = portfolios.find(p => p.id === req.params.portfolioId);

    if (!portfolio) {
        return res.status(404).json({ error: 'Portfolio not found' });
    }

    const stock = portfolio.assets.find(a => a.id === req.params.stockId);

    if (!stock) {
        return res.status(404).json({ error: 'Stock not found in portfolio' });
    }

    const { purchasePrice } = req.body;

    if (purchasePrice === undefined || purchasePrice === null) {
        return res.status(400).json({ error: 'Purchase price is required' });
    }

    const newPrice = parseFloat(purchasePrice);
    if (isNaN(newPrice) || newPrice < 0) {
        return res.status(400).json({ error: 'Purchase price must be a valid positive number' });
    }

    try {
        // Update the stock purchase price
        stock.purchasePrice = newPrice;
        stock.totalValue = stock.quantity * stock.currentPrice; // Total value stays based on current price

        // Update portfolio total value
        portfolio.totalValue = portfolio.assets.reduce((sum, asset) => sum + asset.totalValue, 0);

        savePortfolios();

        console.log(`Updated ${stock.symbol} purchase price to $${newPrice}`);
        res.json(portfolio);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update purchase price', message: error.message });
    }
});

// Endpoint to manually update all prices
app.post('/api/refresh-prices', async (req, res) => {
    try {
        const count = await updateAllStockPrices();
        res.json({ message: 'Prices updated', count: count, portfolios: portfolios });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update prices' });
    }
});

app.get('/api/portfolio', (req, res) => {
    res.json({
        portfolios: portfolios
    });
});

// Create a new portfolio
app.post('/api/portfolio', (req, res) => {
    const { name } = req.body;

    if (!name || name.trim() === '') {
        return res.status(400).json({ error: 'Portfolio name is required' });
    }

    const newPortfolio = {
        id: uuidv4(),
        name: name.trim(),
        totalValue: 0,
        assets: [],
        createdAt: new Date()
    };

    portfolios.push(newPortfolio);
    savePortfolios();
    console.log(`Portfolio created: ${newPortfolio.name} (ID: ${newPortfolio.id})`);
    res.status(201).json(newPortfolio);
});

// Get a specific portfolio
app.get('/api/portfolio/:id', (req, res) => {
    const portfolio = portfolios.find(p => p.id === req.params.id);

    if (!portfolio) {
        return res.status(404).json({ error: 'Portfolio not found' });
    }

    res.json(portfolio);
});

// Delete a portfolio
app.delete('/api/portfolio/:id', (req, res) => {
    const index = portfolios.findIndex(p => p.id === req.params.id);

    if (index === -1) {
        return res.status(404).json({ error: 'Portfolio not found' });
    }

    const deletedPortfolio = portfolios.splice(index, 1);
    savePortfolios();
    console.log(`Portfolio deleted: ${deletedPortfolio[0].name}`);
    res.json({ message: 'Portfolio deleted', portfolio: deletedPortfolio[0] });
});

// Update a portfolio
app.put('/api/portfolio/:id', (req, res) => {
    const portfolio = portfolios.find(p => p.id === req.params.id);

    if (!portfolio) {
        return res.status(404).json({ error: 'Portfolio not found' });
    }

    if (req.body.name) {
        portfolio.name = req.body.name.trim();
    }
    if (req.body.totalValue !== undefined) {
        portfolio.totalValue = req.body.totalValue;
    }
    if (req.body.assets) {
        portfolio.assets = req.body.assets;
    }

    res.json(portfolio);
});

// Development only: Shutdown endpoint
if (process.env.NODE_ENV === 'development') {
    app.post('/api/shutdown', (req, res) => {
        res.json({ message: 'Shutting down servers...' });
        console.log('Shutdown requested - terminating...');
        // Force exit with a hard kill to prevent nodemon from restarting
        setTimeout(() => {
            process.kill(process.pid, 'SIGTERM');
        }, 500);
    });
}

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'Route not found' });
    }

    res.status(404).sendFile(path.join(publicDir, 'index.html'));
});

app.listen(PORT, '0.0.0.0', async () => {
    console.log(`Server is running on http://0.0.0.0:${PORT}`);
});

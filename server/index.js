const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
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
    'GOOG': 'Alphabet Inc.',
    'AVGO': 'Broadcom Inc.',
    'VOO': 'Vanguard S&P 500 ETF',
    'ZION': 'Zions Bancorporation',
    'SPY': 'SPDR S&P 500 ETF',
    'QQQ': 'Invesco QQQ Trust (Nasdaq-100)',
    'VTI': 'Vanguard Total Stock Market ETF',
    'IEF': 'iShares 7-10 Year Treasury Bond ETF',
    'LQD': 'iShares iBoxx Investment Grade Corporate Bond ETF',
    'BND': 'Vanguard Total Bond Market ETF',
    'GLD': 'SPDR Gold Trust'
};

// Persistent storage for portfolios
const portfoliosFile = path.join(__dirname, 'portfolios.json');

// Persistent storage for calendar events
const calendarFile = path.join(__dirname, 'calendar.json');

// Persistent storage for AI portfolio
const aiPortfolioFile = path.join(__dirname, 'aiportfolio.json');

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

function loadAIPortfolio() {
    try {
        if (fs.existsSync(aiPortfolioFile)) {
            const data = fs.readFileSync(aiPortfolioFile, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading AI portfolio:', error);
    }

    return {
        currentAllocation: {
            date: new Date().toISOString().split('T')[0],
            regime: 'Neutral',
            weights: { SPY: 0.25, VOO: 0.10, QQQ: 0.10, IEF: 0.25, LQD: 0.15, BND: 0.10, GLD: 0.05 },
            indicators: { spyClose: 0, ma50: 0, ma200: 0, vol20: 0, dd63: 0 },
            reason: 'Initial allocation - Neutral regime as default starting point'
        },
        rebalanceHistory: [],
        modelPerformance: {
            startDate: new Date().toISOString().split('T')[0],
            startingNAV: 100000,
            currentNAV: 100000,
            positions: {
                SPY: { shares: 0, value: 0 },
                VOO: { shares: 0, value: 0 },
                QQQ: { shares: 0, value: 0 },
                VTI: { shares: 0, value: 0 },
                IEF: { shares: 0, value: 0 },
                LQD: { shares: 0, value: 0 },
                BND: { shares: 0, value: 0 },
                GLD: { shares: 0, value: 0 },
                CASH: 100000
            },
            equityCurve: [],
            monthlyReturns: []
        },
        priceHistory: { SPY: [], VOO: [], QQQ: [], VTI: [], IEF: [], LQD: [], BND: [], GLD: [] }
    };
}

function saveAIPortfolio() {
    try {
        fs.writeFileSync(aiPortfolioFile, JSON.stringify(aiPortfolioData, null, 2));
    } catch (error) {
        console.error('Error saving AI portfolio:', error);
    }
}

// Load portfolios from file on startup
let portfolios = loadPortfolios();

// Migrate existing portfolios to add totalInvested if missing
portfolios.forEach(portfolio => {
    if (portfolio.totalInvested === undefined) {
        portfolio.totalInvested = portfolio.assets.reduce((sum, asset) => {
            return sum + (asset.purchasePrice * asset.quantity);
        }, 0);
        console.log(`Migrated ${portfolio.name}: totalInvested = $${portfolio.totalInvested.toFixed(2)}`);
    }
});
savePortfolios();

// Load calendar events from file on startup
let calendarEvents = loadCalendarEvents();

// Load AI portfolio data
let aiPortfolioData = loadAIPortfolio();

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
    'GOOG': 140.32,
    'AVGO': 178.92,
    'VOO': 524.67,
    'ZION': 52.34,
    'SPY': 578.45,
    'QQQ': 476.23,
    'VTI': 287.34,
    'IEF': 96.45,
    'LQD': 112.83,
    'BND': 72.18,
    'GLD': 189.76
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
        } else {
            // If not in database, throw error instead of using random price
            throw new Error(`Stock ${upperSymbol} not found in database or APIs`);
        }
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
    const { title, date, time, notes, color, recurrence, recurrenceEndDate, owner } = req.body;

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
        recurrence: recurrence || 'none',
        recurrenceEndDate: recurrenceEndDate && recurrence !== 'none' ? recurrenceEndDate.trim() : '',
        owner: owner === 'A' || owner === 'P' ? owner : 'A',
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
    if (req.body.recurrence !== undefined) {
        event.recurrence = req.body.recurrence;
    }
    if (req.body.recurrenceEndDate !== undefined) {
        event.recurrenceEndDate = req.body.recurrenceEndDate.trim();
    }
    if (req.body.owner !== undefined && (req.body.owner === 'A' || req.body.owner === 'P')) {
        event.owner = req.body.owner;
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

        // Update portfolio total invested (add the cost of new purchase)
        if (!portfolio.totalInvested) portfolio.totalInvested = 0;
        portfolio.totalInvested += purchasePrice * quantity;

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

    const removedStock = portfolio.assets.splice(stockIndex, 1)[0];

    // Update portfolio total invested (subtract the original cost)
    if (!portfolio.totalInvested) portfolio.totalInvested = 0;
    portfolio.totalInvested -= removedStock.purchasePrice * removedStock.quantity;
    if (portfolio.totalInvested < 0) portfolio.totalInvested = 0;

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

    // Update totalInvested (remove old cost, add new cost)
    if (!portfolio.totalInvested) portfolio.totalInvested = 0;
    portfolio.totalInvested -= stock.purchasePrice * stock.quantity;
    portfolio.totalInvested += purchasePrice * stock.quantity;

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

// Adjust portfolio investment (add/remove capital)
app.put('/api/portfolio/:portfolioId/adjust-investment', (req, res) => {
    const portfolio = portfolios.find(p => p.id === req.params.portfolioId);

    if (!portfolio) {
        return res.status(404).json({ error: 'Portfolio not found' });
    }

    const { amount, note } = req.body;

    if (amount === undefined || amount === null) {
        return res.status(400).json({ error: 'Amount is required' });
    }

    const adjustment = parseFloat(amount);
    if (isNaN(adjustment)) {
        return res.status(400).json({ error: 'Amount must be a valid number' });
    }

    // Initialize totalInvested if missing
    if (!portfolio.totalInvested) portfolio.totalInvested = 0;

    // Adjust the investment
    portfolio.totalInvested += adjustment;

    // Don't allow negative totalInvested
    if (portfolio.totalInvested < 0) {
        return res.status(400).json({ error: 'Cannot withdraw more than total invested' });
    }

    savePortfolios();

    const action = adjustment >= 0 ? 'Added' : 'Withdrew';
    console.log(`${action} $${Math.abs(adjustment).toFixed(2)} ${adjustment >= 0 ? 'to' : 'from'} ${portfolio.name}. Total invested: $${portfolio.totalInvested.toFixed(2)}`);

    res.json({
        portfolio,
        message: `${action} $${Math.abs(adjustment).toFixed(2)}`,
        totalInvested: portfolio.totalInvested
    });
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

// =============================================================================
// AI PORTFOLIO - Regime-aware Factor Rotation
// =============================================================================

// Helper functions for regime calculation
function calculateMA(prices, period) {
    if (prices.length < period) return null;
    const slice = prices.slice(-period);
    return slice.reduce((sum, p) => sum + p.close, 0) / period;
}

function calculateVolatility(prices, period) {
    if (prices.length < period) return null;
    const slice = prices.slice(-period);
    const returns = [];
    for (let i = 1; i < slice.length; i++) {
        returns.push(Math.log(slice[i].close / slice[i - 1].close));
    }
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    return Math.sqrt(variance * 252); // Annualized
}

function calculateDrawdown(prices, period) {
    if (prices.length < period) return null;
    const slice = prices.slice(-period);
    const maxPrice = Math.max(...slice.map(p => p.close));
    const currentPrice = slice[slice.length - 1].close;
    return (currentPrice - maxPrice) / maxPrice;
}

function determineRegime(spyPrices) {
    if (spyPrices.length < 200) {
        return {
            regime: 'Neutral',
            indicators: {},
            reason: 'Insufficient price history (need 200 days minimum)'
        };
    }

    const currentClose = spyPrices[spyPrices.length - 1].close;
    const ma50 = calculateMA(spyPrices, 50);
    const ma200 = calculateMA(spyPrices, 200);
    const vol20 = calculateVolatility(spyPrices, 20);
    const dd63 = calculateDrawdown(spyPrices, 63);

    const indicators = {
        spyClose: currentClose,
        ma50: ma50,
        ma200: ma200,
        vol20: vol20,
        dd63: dd63
    };

    // Thresholds
    const VOL_RISK_ON = 0.20;
    const VOL_RISK_OFF = 0.30;
    const DD_RISK_OFF = -0.10;

    let regime = 'Neutral';
    let reasons = [];

    // Risk-Off conditions (highest priority)
    if (currentClose < ma200) {
        regime = 'Risk-Off';
        reasons.push(`SPY closed below 200-day MA (${currentClose.toFixed(2)} vs ${ma200.toFixed(2)})`);
    }
    if (dd63 < DD_RISK_OFF) {
        regime = 'Risk-Off';
        reasons.push(`Drawdown from 63-day high is ${(dd63 * 100).toFixed(2)}% (threshold: ${DD_RISK_OFF * 100}%)`);
    }
    if (vol20 > VOL_RISK_OFF) {
        regime = 'Risk-Off';
        reasons.push(`20-day volatility is ${(vol20 * 100).toFixed(2)}% (threshold: ${VOL_RISK_OFF * 100}%)`);
    }

    // Risk-On conditions (if not Risk-Off)
    if (regime === 'Neutral' && currentClose > ma200 && currentClose > ma50 && vol20 < VOL_RISK_ON) {
        regime = 'Risk-On';
        reasons.push(`SPY above both MAs (${currentClose.toFixed(2)} > ${ma50.toFixed(2)}, ${ma200.toFixed(2)})`);
        reasons.push(`Low volatility at ${(vol20 * 100).toFixed(2)}% (threshold: ${VOL_RISK_ON * 100}%)`);
    }

    const reason = reasons.length > 0 ? reasons.join('. ') : 'Market conditions are mixed - defaulting to Neutral regime.';

    return { regime, indicators, reason };
}

function getTargetWeights(regime) {
    const allocations = {
        'Risk-On': { SPY: 0.35, VOO: 0.15, QQQ: 0.20, VTI: 0.10, IEF: 0.08, LQD: 0.07, BND: 0.03, GLD: 0.02 },
        'Neutral': { SPY: 0.25, VOO: 0.10, QQQ: 0.10, VTI: 0.05, IEF: 0.25, LQD: 0.15, BND: 0.07, GLD: 0.03 },
        'Risk-Off': { SPY: 0.10, VOO: 0.05, QQQ: 0.03, VTI: 0.02, IEF: 0.40, LQD: 0.15, BND: 0.15, GLD: 0.10 }
    };
    return allocations[regime] || allocations['Neutral'];
}

async function simulateRebalance(currentPositions, targetWeights, prices, transactionCost = 0.0005) {
    const symbols = ['SPY', 'VOO', 'QQQ', 'VTI', 'IEF', 'LQD', 'BND', 'GLD'];
    const currentNAV = Object.keys(currentPositions).reduce((sum, symbol) => {
        return sum + (currentPositions[symbol].value || 0);
    }, 0) + (currentPositions.CASH || 0);

    const targetValues = {};
    symbols.forEach(symbol => {
        targetValues[symbol] = currentNAV * targetWeights[symbol];
    });

    const newPositions = { CASH: 0 };
    let totalTransactionCosts = 0;
    const trades = [];

    for (const symbol of symbols) {
        const currentValue = currentPositions[symbol]?.value || 0;
        const targetValue = targetValues[symbol];
        const price = prices[symbol];

        if (!price) {
            console.error(`No price found for ${symbol}`);
            continue;
        }

        const targetShares = Math.floor(targetValue / price);
        const currentShares = currentPositions[symbol]?.shares || 0;
        const shareDiff = targetShares - currentShares;

        if (shareDiff !== 0) {
            const tradeCost = Math.abs(shareDiff * price) * transactionCost;
            totalTransactionCosts += tradeCost;
            trades.push({
                symbol,
                action: shareDiff > 0 ? 'BUY' : 'SELL',
                shares: Math.abs(shareDiff),
                price,
                cost: tradeCost
            });
        }

        newPositions[symbol] = {
            shares: targetShares,
            value: targetShares * price
        };
    }

    // Calculate cash after transactions
    const totalInvested = symbols.reduce((sum, symbol) => sum + newPositions[symbol].value, 0);
    newPositions.CASH = currentNAV - totalInvested - totalTransactionCosts;

    const finalNAV = Object.keys(newPositions).reduce((sum, symbol) => {
        return sum + (newPositions[symbol].value || 0);
    }, 0) + newPositions.CASH;

    const turnover = trades.reduce((sum, trade) => sum + (trade.shares * trade.price), 0) / currentNAV;

    return {
        newPositions,
        trades,
        turnover: turnover,
        transactionCosts: totalTransactionCosts,
        navBefore: currentNAV,
        navAfter: finalNAV
    };
}

// Sync AI Portfolio to Portfolio Manager
function syncAIPortfolioToManager() {
    try {
        // Find or create AI Portfolio in portfolios list
        let aiPortfolioIndex = portfolios.findIndex(p => p.id === 'ai-managed-portfolio');

        // Get current positions and NAV
        const positions = aiPortfolioData.modelPerformance.positions;
        const currentNAV = aiPortfolioData.modelPerformance.currentNAV;
        const startingNAV = aiPortfolioData.modelPerformance.startingNAV;

        // Calculate cost basis: distribute the starting NAV proportionally to current positions
        // This shows what the "purchase price" would have been if we bought at inception
        const totalCurrentValue = Object.keys(positions)
            .filter(symbol => symbol !== 'CASH')
            .reduce((sum, symbol) => sum + (positions[symbol]?.value || 0), 0);

        // If we have no positions yet, use starting NAV
        const costBasisMultiplier = totalCurrentValue > 0 ? startingNAV / totalCurrentValue : 1;

        // Convert positions to portfolio assets format
        const assets = Object.entries(positions)
            .filter(([symbol]) => symbol !== 'CASH')
            .map(([symbol, pos]) => {
                if (!pos.shares || pos.shares === 0) return null;

                const currentPrice = pos.value / pos.shares;
                // Calculate purchase price to show proper gain/loss
                // purchasePrice * shares * currentNAV/startingNAV = currentValue
                const purchasePrice = currentPrice * costBasisMultiplier;

                return {
                    id: `ai-${symbol.toLowerCase()}`,
                    symbol: symbol,
                    name: stockNames[symbol] || symbol,
                    quantity: Math.round(pos.shares * 100) / 100,
                    purchasePrice: Math.round(purchasePrice * 100) / 100,
                    currentPrice: Math.round(currentPrice * 100) / 100,
                    totalValue: Math.round(pos.value * 100) / 100,
                    currency: 'USD',
                    purchaseDate: aiPortfolioData.modelPerformance.startDate || new Date().toISOString(),
                    addedAt: new Date().toISOString()
                };
            })
            .filter(asset => asset !== null);

        // Calculate total invested (should equal starting NAV distributed across positions)
        const totalInvested = assets.reduce((sum, asset) => sum + (asset.purchasePrice * asset.quantity), 0);

        const aiPortfolio = {
            id: 'ai-managed-portfolio',
            name: '🤖 AI Managed Portfolio',
            totalValue: Math.round(currentNAV * 100) / 100,
            assets: assets,
            createdAt: aiPortfolioData.modelPerformance.startDate || new Date().toISOString(),
            isAIManaged: true,
            metadata: {
                startingNAV: startingNAV,
                totalInvested: Math.round(totalInvested * 100) / 100,
                gainLoss: Math.round((currentNAV - startingNAV) * 100) / 100,
                gainLossPercent: ((currentNAV - startingNAV) / startingNAV * 100).toFixed(2)
            }
        };

        if (aiPortfolioIndex >= 0) {
            portfolios[aiPortfolioIndex] = aiPortfolio;
        } else {
            portfolios.push(aiPortfolio);
        }

        savePortfolios();
        console.log(`AI Portfolio synced: $${currentNAV.toFixed(2)} (${((currentNAV - startingNAV) / startingNAV * 100).toFixed(2)}% return)`);
    } catch (error) {
        console.error('Failed to sync AI Portfolio:', error);
    }
}

// API Endpoints

// Get current allocation
app.get('/api/ai-portfolio/allocation/current', (req, res) => {
    res.json(aiPortfolioData.currentAllocation);
});

// Get allocation history
app.get('/api/ai-portfolio/allocation/history', (req, res) => {
    res.json({ history: aiPortfolioData.rebalanceHistory });
});

// Get model performance
app.get('/api/ai-portfolio/model/performance', (req, res) => {
    const { from, to } = req.query;
    let equityCurve = aiPortfolioData.modelPerformance.equityCurve;

    if (from || to) {
        equityCurve = equityCurve.filter(point => {
            const date = point.date;
            if (from && date < from) return false;
            if (to && date > to) return false;
            return true;
        });
    }

    res.json({
        ...aiPortfolioData.modelPerformance,
        equityCurve
    });
});

// Get all rebalances
app.get('/api/ai-portfolio/model/rebalances', (req, res) => {
    res.json({ rebalances: aiPortfolioData.rebalanceHistory });
});

// Get specific rebalance details
app.get('/api/ai-portfolio/model/rebalance/:date', (req, res) => {
    const rebalance = aiPortfolioData.rebalanceHistory.find(r => r.date === req.params.date);
    if (!rebalance) {
        return res.status(404).json({ error: 'Rebalance not found' });
    }
    res.json(rebalance);
});

// Manual trigger for rebalance (for testing)
app.post('/api/ai-portfolio/rebalance', async (req, res) => {
    try {
        const symbols = ['SPY', 'VOO', 'QQQ', 'VTI', 'IEF', 'LQD', 'BND', 'GLD'];

        // Fetch latest prices
        const prices = {};
        for (const symbol of symbols) {
            try {
                const stockData = await getStockPrice(symbol);
                prices[symbol] = stockData.price;

                // Add to price history
                if (!aiPortfolioData.priceHistory[symbol]) {
                    aiPortfolioData.priceHistory[symbol] = [];
                }
                aiPortfolioData.priceHistory[symbol].push({
                    date: new Date().toISOString().split('T')[0],
                    close: stockData.price
                });
            } catch (error) {
                console.error(`Failed to get price for ${symbol}:`, error);
                return res.status(500).json({ error: `Failed to fetch price for ${symbol}` });
            }
        }

        // Determine regime
        const { regime, indicators, reason } = determineRegime(aiPortfolioData.priceHistory.SPY);
        const targetWeights = getTargetWeights(regime);

        // Simulate rebalance
        const rebalanceResult = await simulateRebalance(
            aiPortfolioData.modelPerformance.positions,
            targetWeights,
            prices
        );

        // Update model performance
        aiPortfolioData.modelPerformance.positions = rebalanceResult.newPositions;
        aiPortfolioData.modelPerformance.currentNAV = rebalanceResult.navAfter;

        // Add to equity curve
        aiPortfolioData.modelPerformance.equityCurve.push({
            date: new Date().toISOString().split('T')[0],
            nav: rebalanceResult.navAfter,
            regime: regime
        });

        // Update current allocation
        const newAllocation = {
            date: new Date().toISOString().split('T')[0],
            regime: regime,
            weights: targetWeights,
            indicators: indicators,
            reason: reason
        };

        // Save to history
        aiPortfolioData.rebalanceHistory.push({
            ...newAllocation,
            trades: rebalanceResult.trades,
            turnover: rebalanceResult.turnover,
            transactionCosts: rebalanceResult.transactionCosts,
            navBefore: rebalanceResult.navBefore,
            navAfter: rebalanceResult.navAfter
        });

        aiPortfolioData.currentAllocation = newAllocation;

        // Save to disk
        saveAIPortfolio();

        // Sync to Portfolio Manager
        syncAIPortfolioToManager();

        res.json({
            message: 'Rebalance completed',
            allocation: newAllocation,
            performance: {
                navBefore: rebalanceResult.navBefore,
                navAfter: rebalanceResult.navAfter,
                turnover: rebalanceResult.turnover,
                transactionCosts: rebalanceResult.transactionCosts
            }
        });
    } catch (error) {
        console.error('Rebalance error:', error);
        res.status(500).json({ error: 'Failed to execute rebalance', message: error.message });
    }
});

// =============================================================================
// END AI PORTFOLIO
// =============================================================================

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

    // Schedule nightly AI portfolio update (runs at 6 PM EST every Friday)
    // Cron format: minute hour day-of-month month day-of-week
    cron.schedule('0 18 * * 5', async () => {
        console.log('Running scheduled AI portfolio rebalance...');
        try {
            const symbols = ['SPY', 'VOO', 'QQQ', 'VTI', 'IEF', 'LQD', 'BND', 'GLD'];

            // Fetch latest prices
            const prices = {};
            for (const symbol of symbols) {
                try {
                    const stockData = await getStockPrice(symbol);
                    prices[symbol] = stockData.price;

                    if (!aiPortfolioData.priceHistory[symbol]) {
                        aiPortfolioData.priceHistory[symbol] = [];
                    }
                    aiPortfolioData.priceHistory[symbol].push({
                        date: new Date().toISOString().split('T')[0],
                        close: stockData.price
                    });
                } catch (error) {
                    console.error(`Failed to get price for ${symbol}:`, error);
                }
            }

            // Only rebalance if we have enough price history
            if (aiPortfolioData.priceHistory.SPY.length >= 200) {
                const { regime, indicators, reason } = determineRegime(aiPortfolioData.priceHistory.SPY);
                const targetWeights = getTargetWeights(regime);

                const rebalanceResult = await simulateRebalance(
                    aiPortfolioData.modelPerformance.positions,
                    targetWeights,
                    prices
                );

                aiPortfolioData.modelPerformance.positions = rebalanceResult.newPositions;
                aiPortfolioData.modelPerformance.currentNAV = rebalanceResult.navAfter;

                aiPortfolioData.modelPerformance.equityCurve.push({
                    date: new Date().toISOString().split('T')[0],
                    nav: rebalanceResult.navAfter,
                    regime: regime
                });

                const newAllocation = {
                    date: new Date().toISOString().split('T')[0],
                    regime: regime,
                    weights: targetWeights,
                    indicators: indicators,
                    reason: reason
                };

                aiPortfolioData.rebalanceHistory.push({
                    ...newAllocation,
                    trades: rebalanceResult.trades,
                    turnover: rebalanceResult.turnover,
                    transactionCosts: rebalanceResult.transactionCosts,
                    navBefore: rebalanceResult.navBefore,
                    navAfter: rebalanceResult.navAfter
                });

                aiPortfolioData.currentAllocation = newAllocation;
                saveAIPortfolio();

                // Sync to Portfolio Manager
                syncAIPortfolioToManager();

                console.log(`Scheduled rebalance completed. Regime: ${regime}, NAV: $${rebalanceResult.navAfter.toLocaleString()}`);
            } else {
                console.log('Not enough price history for rebalance. Need 200 days, have:', aiPortfolioData.priceHistory.SPY.length);
            }
        } catch (error) {
            console.error('Scheduled rebalance failed:', error);
        }
    }, {
        timezone: "America/New_York"
    });

    console.log('AI Portfolio scheduled job configured (Fridays at 6 PM EST)');
});

// =============================================================================
// CHESS BOARD PROJECT API
// =============================================================================

const chessProjectFile = path.join(__dirname, 'chessproject.json');

function loadChessProject() {
    try {
        if (fs.existsSync(chessProjectFile)) {
            return JSON.parse(fs.readFileSync(chessProjectFile, 'utf8'));
        }
    } catch (error) {
        console.error('Error loading chess project data:', error);
    }

    return {
        projectLinks: {
            github: 'https://github.com',
            drive: 'https://drive.google.com'
        },
        teamMembers: [],
        availability: [],
        projectEvents: [],
        games: []
    };
}

function saveChessProject() {
    try {
        fs.writeFileSync(chessProjectFile, JSON.stringify(chessProjectData, null, 2));
    } catch (error) {
        console.error('Error saving chess project data:', error);
    }
}

let chessProjectData = loadChessProject();

// Project Links
app.get('/api/chess/project/links', (req, res) => {
    res.json(chessProjectData.projectLinks);
});

app.put('/api/chess/project/links', (req, res) => {
    if (req.body.github) chessProjectData.projectLinks.github = req.body.github;
    if (req.body.drive) chessProjectData.projectLinks.drive = req.body.drive;
    saveChessProject();
    res.json(chessProjectData.projectLinks);
});

// Team Members
app.get('/api/chess/team/members', (req, res) => {
    res.json({ members: chessProjectData.teamMembers });
});

app.post('/api/chess/team/member', (req, res) => {
    const { name, role } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'Name is required' });
    }

    const member = {
        id: uuidv4(),
        name: name.trim(),
        role: (role || 'Team Member').trim(),
        addedAt: new Date().toISOString()
    };

    chessProjectData.teamMembers.push(member);
    saveChessProject();
    res.status(201).json(member);
});

app.delete('/api/chess/team/member/:id', (req, res) => {
    const index = chessProjectData.teamMembers.findIndex(m => m.id === req.params.id);
    if (index === -1) {
        return res.status(404).json({ error: 'Member not found' });
    }

    const removed = chessProjectData.teamMembers.splice(index, 1);
    saveChessProject();
    res.json({ message: 'Member removed', member: removed[0] });
});

// Meeting Availability
app.get('/api/chess/meeting/availability', (req, res) => {
    res.json({ availability: chessProjectData.availability });
});

app.post('/api/chess/meeting/availability', (req, res) => {
    const { name, date, timeFrom, timeTo } = req.body;

    if (!name || !date || !timeFrom || !timeTo) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    const slot = {
        name: name.trim(),
        date,
        timeFrom,
        timeTo,
        addedAt: new Date().toISOString()
    };

    chessProjectData.availability.push(slot);
    saveChessProject();
    res.status(201).json(slot);
});

app.delete('/api/chess/meeting/availability/:index', (req, res) => {
    const index = parseInt(req.params.index);
    if (index < 0 || index >= chessProjectData.availability.length) {
        return res.status(404).json({ error: 'Availability not found' });
    }

    const removed = chessProjectData.availability.splice(index, 1);
    saveChessProject();
    res.json({ message: 'Availability removed', slot: removed[0] });
});

app.get('/api/chess/meeting/best-time', (req, res) => {
    const availability = chessProjectData.availability;

    if (availability.length === 0) {
        return res.json({ bestTime: null });
    }

    // Group by date
    const byDate = {};
    availability.forEach(slot => {
        if (!byDate[slot.date]) byDate[slot.date] = [];
        byDate[slot.date].push(slot);
    });

    // Find date with most availability
    let bestDate = null;
    let maxCount = 0;

    for (const date in byDate) {
        if (byDate[date].length > maxCount) {
            maxCount = byDate[date].length;
            bestDate = date;
        }
    }

    if (!bestDate || maxCount < 2) {
        return res.json({ bestTime: null });
    }

    // Find overlapping time on best date
    const slots = byDate[bestDate];
    const members = slots.map(s => s.name);

    // Simple overlap: use earliest start and latest end that overlaps
    const times = slots.map(s => ({
        from: s.timeFrom,
        to: s.timeTo
    }));

    const latestStart = times.reduce((max, t) => t.from > max ? t.from : max, times[0].from);
    const earliestEnd = times.reduce((min, t) => t.to < min ? t.to : min, times[0].to);

    res.json({
        bestTime: {
            date: bestDate,
            timeFrom: latestStart,
            timeTo: earliestEnd,
            members: members
        }
    });
});

// Project Events
app.get('/api/chess/project/events', (req, res) => {
    res.json({ events: chessProjectData.projectEvents });
});

app.post('/api/chess/project/event', (req, res) => {
    const { title, date, time, notes } = req.body;

    if (!title || !date) {
        return res.status(400).json({ error: 'Title and date are required' });
    }

    const event = {
        id: uuidv4(),
        title: title.trim(),
        date,
        time: time || '',
        notes: notes || '',
        createdAt: new Date().toISOString()
    };

    chessProjectData.projectEvents.push(event);
    saveChessProject();
    res.status(201).json(event);
});

app.put('/api/chess/project/event/:id', (req, res) => {
    const event = chessProjectData.projectEvents.find(e => e.id === req.params.id);

    if (!event) {
        return res.status(404).json({ error: 'Event not found' });
    }

    if (req.body.title) event.title = req.body.title.trim();
    if (req.body.date) event.date = req.body.date;
    if (req.body.time !== undefined) event.time = req.body.time;
    if (req.body.notes !== undefined) event.notes = req.body.notes;

    saveChessProject();
    res.json(event);
});

app.delete('/api/chess/project/event/:id', (req, res) => {
    const index = chessProjectData.projectEvents.findIndex(e => e.id === req.params.id);

    if (index === -1) {
        return res.status(404).json({ error: 'Event not found' });
    }

    const removed = chessProjectData.projectEvents.splice(index, 1);
    saveChessProject();
    res.json({ message: 'Event deleted', event: removed[0] });
});

// Chess Game API Endpoints
app.get('/api/chess/status', (req, res) => {
    res.json({
        status: 'online',
        version: '1.0.0',
        activeGames: chessProjectData.games.length
    });
});

app.get('/api/chess/games', (req, res) => {
    res.json({ games: chessProjectData.games });
});

app.post('/api/chess/game', (req, res) => {
    const { player1, player2 } = req.body;

    if (!player1 || !player2) {
        return res.status(400).json({ error: 'Both players are required' });
    }

    const game = {
        id: uuidv4(),
        player1,
        player2,
        status: 'active',
        moves: [],
        board: initializeChessBoard(),
        createdAt: new Date().toISOString(),
        lastMove: null
    };

    chessProjectData.games.push(game);
    saveChessProject();
    res.status(201).json(game);
});

app.get('/api/chess/game/:gameId', (req, res) => {
    const game = chessProjectData.games.find(g => g.id === req.params.gameId);

    if (!game) {
        return res.status(404).json({ error: 'Game not found' });
    }

    res.json(game);
});

app.post('/api/chess/move', (req, res) => {
    const { gameId, from, to, piece } = req.body;

    if (!gameId || !from || !to || !piece) {
        return res.status(400).json({ error: 'gameId, from, to, and piece are required' });
    }

    const game = chessProjectData.games.find(g => g.id === gameId);

    if (!game) {
        return res.status(404).json({ error: 'Game not found' });
    }

    if (game.status !== 'active') {
        return res.status(400).json({ error: 'Game is not active' });
    }

    const move = {
        from,
        to,
        piece,
        timestamp: new Date().toISOString(),
        moveNumber: game.moves.length + 1
    };

    game.moves.push(move);
    game.lastMove = new Date().toISOString();

    saveChessProject();
    res.json({ game, move });
});

app.delete('/api/chess/game/:gameId', (req, res) => {
    const index = chessProjectData.games.findIndex(g => g.id === req.params.gameId);

    if (index === -1) {
        return res.status(404).json({ error: 'Game not found' });
    }

    const removed = chessProjectData.games.splice(index, 1);
    saveChessProject();
    res.json({ message: 'Game ended', game: removed[0] });
});

function initializeChessBoard() {
    return {
        pieces: [],
        currentTurn: 'white'
    };
}

// =============================================================================
// END CHESS BOARD PROJECT API
// =============================================================================

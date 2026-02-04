# AI-Managed Portfolio - Setup & Usage Guide

## Overview
You've successfully implemented a **Regime-Aware Factor Rotation** AI portfolio system at `/portfolio/aiportfolio`.

## Features Implemented

### ✅ Backend (Node.js/Express)
- **Regime Calculation Engine**
  - Indicators: MA50, MA200, Vol20 (20-day volatility), DD63 (63-day drawdown)
  - 3 Regimes: Risk-On, Neutral, Risk-Off
  - Thresholds: Vol20 < 20% (Risk-On), Vol20 > 30% (Risk-Off), DD63 < -10% (Risk-Off)

- **Portfolio Simulation**
  - 4 ETFs: SPY, IEF, LQD, GLD
  - Transaction cost: 0.05% per trade
  - NAV tracking with equity curve
  - Position management with share calculations

- **API Endpoints**
  - `GET /api/ai-portfolio/allocation/current` - Current regime & weights
  - `GET /api/ai-portfolio/allocation/history` - All rebalance events
  - `GET /api/ai-portfolio/model/performance` - NAV & equity curve
  - `GET /api/ai-portfolio/model/rebalances` - Detailed rebalance history
  - `POST /api/ai-portfolio/rebalance` - Manual trigger (for testing)

- **Scheduled Job**
  - Runs **every Friday at 6 PM EST**
  - Fetches latest prices for SPY, IEF, LQD, GLD
  - Calculates regime and rebalances if needed
  - Saves history and updates performance

### ✅ Frontend (React)
- **Current Allocation Tab**
  - Visual regime display with colors
  - Target weights with circular progress
  - Indicator values (MA50, MA200, Vol20, DD63)
  - Explanation of "why" this regime

- **Performance Tab**
  - NAV summary (starting, current, total return)
  - Equity curve chart (Line chart)
  - Current positions table

- **History Tab**
  - All past rebalances
  - Expandable details showing trades, weights, turnover
  - Regime changes over time

## How to Use

### Initial Setup

1. **Install Dependencies**
   ```bash
   cd server
   npm install node-cron
   
   cd ../client
   npm install  # (chart.js already in package.json)
   ```

2. **Build React App**
   ```bash
   cd client
   PUBLIC_URL=/portfolio npm run build
   ```

3. **Deploy to Server**
   - Copy server files to EC2: `/home/ubuntu/website/server/`
   - Copy client/build to EC2: `/home/ubuntu/website/client/build/`
   - Restart PM2: `pm2 restart paytonschutte`

### Initialize Portfolio

The portfolio needs **200 days of price history** before it can calculate regimes. You have two options:

**Option 1: Manual Trigger (Bootstrap)**
1. Visit `http://paytonschutte.com/portfolio/aiportfolio`
2. Click "Manual Rebalance" button multiple times (simulate different dates)
3. This will populate price history and create initial positions

**Option 2: Backfill Historical Data**
Add historical SPY/IEF/LQD/GLD prices to `aiportfolio.json`:
```json
{
  "priceHistory": {
    "SPY": [
      {"date": "2025-06-01", "close": 510.23},
      {"date": "2025-06-02", "close": 512.45},
      ... (200+ days)
    ],
    "IEF": [...],
    "LQD": [...],
    "GLD": [...]
  }
}
```

### Testing the System

1. **Manual Rebalance**
   - Click "Manual Rebalance" in the UI
   - Checks current regime and rebalances positions
   - View results in History tab

2. **Check Schedule**
   - Server logs show: "AI Portfolio scheduled job configured (Fridays at 6 PM EST)"
   - Every Friday at 6 PM EST, it auto-rebalances

3. **Monitor Performance**
   - Performance tab shows NAV growth
   - Equity curve visualizes returns over time
   - Compare regimes and their performance

## Regime Allocations

### Risk-On (Bullish)
- SPY: 70% (high equity exposure)
- IEF: 15% (low bonds)
- LQD: 10%
- GLD: 5%

### Neutral (Mixed)
- SPY: 45% (balanced)
- IEF: 35% (higher bonds)
- LQD: 15%
- GLD: 5%

### Risk-Off (Defensive)
- SPY: 20% (minimal equity)
- IEF: 60% (flight to safety)
- LQD: 10%
- GLD: 10% (safe haven)

## File Structure

```
server/
  index.js          # Added AI portfolio logic, endpoints, scheduled job
  aiportfolio.json  # Persistent storage for allocations, rebalances, performance
  package.json      # Added node-cron dependency

client/src/
  AIPortfolio.js    # Main AI portfolio component
  AIPortfolio.css   # Styling for AI portfolio
  App.js            # Added navigation link
  index.js          # Added /aiportfolio route
```

## Next Steps

### Short-term
1. Initialize the portfolio with 200+ days of price history
2. Test manual rebalance functionality
3. Monitor first scheduled rebalance (next Friday 6 PM)

### Future Enhancements
- Add **risk profiles** (Conservative/Balanced/Aggressive)
- Implement **monthly returns table**
- Add **drawdown chart** visualization
- Create **email alerts** for regime changes
- Add **benchmark comparison** (vs SPY buy-and-hold)
- Implement **backtesting** over historical periods

## Disclaimers

The system includes educational disclaimers:
- "Educational Model Portfolio"
- "Not investment advice"
- "Past performance does not guarantee future results"
- "Hypothetical simulation"

## Support

If you need to:
- **Change rebalance schedule**: Edit the cron expression in server/index.js (line with `cron.schedule`)
- **Adjust regime thresholds**: Modify VOL_RISK_ON, VOL_RISK_OFF, DD_RISK_OFF constants
- **Change allocations**: Edit getTargetWeights() function
- **Add more ETFs**: Extend symbols array and allocation weights

Enjoy your AI-managed portfolio! 🤖📈

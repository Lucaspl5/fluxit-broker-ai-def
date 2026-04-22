# Broker AI Backend - Hybrid Trading System

## Status: Ready for Deployment

Your **Hybrid AI Trading Broker** backend is complete and ready to deploy! This service combines intelligent technical analysis with manual user authorization for maximum control.

---

## What's Included

### Core Features
- **Technical Analysis**: RSI, MACD, Moving Averages (50/200), Volume analysis
- **Signal Generation**: Automatic BUY/SELL signals when 3+ indicators converge
- **Telegram Integration**: Interactive notifications with buy/sell buttons
- **Alpaca Trading**: Execute orders directly when you authorize
- **Complete Database**: Full audit trail of signals, orders, and P&L
- **Real-time P&L**: Track profit/loss for every trade

### Hybrid Architecture
- **AI Bot**: Analyzes markets and generates signals (non-binding)
- **You're in Control**: Authorize each trade via Telegram buttons
- **Stateless Design**: Runs in serverless containers safely
- **External Scheduling**: Analysis triggered by cron jobs (not internal loops)

---

## API Endpoints (Ready)

### Analysis
POST /analysis/run - Triggered by external cron every 15 minutes

### Trading Signals  
GET /signals - Recent signals across all symbols
GET /signals/:symbol - Signals for specific stock

### Orders
GET /orders - All orders
GET /orders/symbol/:symbol - Orders for symbol
POST /orders/:id/authorize - Execute pending order
DELETE /orders/:id - Cancel order

### Performance & P&L
GET /performance - All closed trades
GET /performance/symbol/:symbol - P&L by symbol
GET /performance/stats/summary - Overall statistics

### Configuration
GET /config - All symbol settings
GET /config/:symbol - Specific symbol settings
POST /config/:symbol - Enable monitoring for symbol
POST /config/:symbol/disable - Disable monitoring

### Telegram
POST /webhook/telegram - Webhook for button clicks

### Documentation
GET /api-docs - Interactive Swagger documentation

---

## How It Works

### 1. Technical Analysis (Every 15 Min)
External cron job calls: POST /analysis/run
Fetch 250 recent price bars from Alpaca
Calculate RSI, MACD, MA50, MA200, Volume
Detect convergence: Do 3+ indicators align?
If YES: Generate BUY or SELL signal

### 2. Telegram Notification
Signal found -> Send message to Telegram with signal details -> User clicks button

### 3. Order Execution
User clicks BUY/SELL button -> Create order in database -> Execute on Alpaca -> Send confirmation

### 4. Performance Tracking
Buy order at $150 -> Create performance record -> Monitor price -> Sell at $155 -> Calculate P&L

---

## What You Need

### For Alpaca Trading
1. Alpaca Account: https://alpaca.markets
2. API Credentials: ALPACA_API_KEY and ALPACA_SECRET_KEY

### For Telegram Notifications  
1. Telegram Account
2. Bot Token: Create bot with @BotFather
   - TELEGRAM_BOT_TOKEN
   - TELEGRAM_CHAT_ID (your chat ID)

### For Security
1. API Key: Generate secure key for cron jobs
   - ANALYSIS_API_KEY

---

## Deployment Steps

### Step 1: Deploy Service
Click Deploy button in UI
Your service gets a public URL

### Step 2: Configure Environment Variables
In deployment settings, add your API credentials

### Step 3: Register Telegram Webhook
Run curl command to register webhook endpoint

### Step 4: Create 15-Minute Cron Job
Use Abacus AI Cron Job tool to trigger analysis every 15 minutes

### Step 5: Enable Symbol Monitoring
POST to /config/AAPL to start monitoring

### Step 6: Wait for First Signal
Cron job runs in 15 minutes, signal sent to Telegram

---

## Database Structure

### Signals Table
Each analysis result: symbol, signal type, indicators, reasoning

### Orders Table
All orders: type, quantity, price, status, execution time

### Performance Table
P&L tracking: entry/exit prices, profit/loss, hold duration

### Configuration Table
Symbol settings: indicator periods, thresholds, convergence requirement

---

## Technical Stack

- Framework: NestJS 11.x
- Language: TypeScript (strict mode)
- Database: PostgreSQL with Prisma ORM
- Runtime: Node.js 18+
- Analysis Library: technicalindicators
- Trading API: @alpacahq/alpaca-trade-api
- Telegram API: node-telegram-bot-api
- Documentation: Swagger/OpenAPI

---

## Next Steps

1. Deploy the service (click Deploy button)
2. Configure environment variables
3. Register Telegram webhook
4. Set up 15-minute cron job
5. Enable monitoring for first symbol
6. Monitor first signal generation
7. Test order execution via Telegram

See DEPLOYMENT_GUIDE.md and QUICK_START.md for detailed instructions.

**Your hybrid AI broker is ready to deploy!**

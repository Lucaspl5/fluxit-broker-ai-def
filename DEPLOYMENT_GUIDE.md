# Broker AI Backend - Deployment & Configuration Guide

## 🎯 Overview

You have successfully built a **Hybrid AI Trading Broker** with:
- ✅ Technical Analysis (RSI, MACD, MA50/200, Volume)
- ✅ Automated Signal Generation (3+ convergent indicators)
- ✅ Telegram Integration with Interactive Buttons
- ✅ Alpaca Order Execution
- ✅ Real-time P&L Tracking
- ✅ Complete Trade History Database

---

## 📋 Pre-Deployment Checklist

Before deploying, you need to gather these credentials:

### 1. **Alpaca Trading API** (Stock Trading)
- Sign up at https://alpaca.markets
- Create an API key in your dashboard
- You'll need:
  - `ALPACA_API_KEY` - Your API key
  - `ALPACA_SECRET_KEY` - Your secret key

### 2. **Telegram Bot Token** (Notifications)
- Open Telegram and chat with [@BotFather](https://t.me/botfather)
- Send: `/newbot`
- Follow the prompts to create a bot
- You'll receive:
  - `TELEGRAM_BOT_TOKEN` - The bot token
- Find your chat ID:
  - Open your bot and send any message
  - Visit: `https://api.telegram.org/bot{TOKEN}/getUpdates`
  - Look for `"chat": {"id": xxxxx}`
  - This is your `TELEGRAM_CHAT_ID`

### 3. **API Security Key** (Optional but recommended)
- Generate a secure random key: `openssl rand -hex 32`
- Set as `ANALYSIS_API_KEY` to protect the /analysis/run endpoint

---

## 🚀 Deployment Steps

### Step 1: Deploy to Production

1. Click the **Deploy** button in the UI
2. Your service will be deployed to a public URL like:
   ```
   https://your-broker-ai.abacusai.app
   ```
3. Save this URL - you'll need it for webhook registration

### Step 2: Configure Environment Variables

After deployment, set the environment variables in the deployment console:

```env
# Alpaca Trading
ALPACA_API_KEY=your_alpaca_api_key_here
ALPACA_SECRET_KEY=your_alpaca_secret_key_here

# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here

# API Security
ANALYSIS_API_KEY=your_secure_api_key_here
```

### Step 3: Register Telegram Webhook

Once deployed, register your Telegram webhook:

```bash
curl -X POST https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/setWebhook \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-deployed-url/webhook/telegram",
    "allowed_updates": ["callback_query"]
  }'
```

Replace:
- `{TELEGRAM_BOT_TOKEN}` with your actual token
- `your-deployed-url` with your production URL

### Step 4: Create Analysis Cron Job

To run technical analysis every 15 minutes, create a cron job that calls:

```
POST https://your-deployed-url/analysis/run
Headers: Content-Type: application/json
Body: { "api_key": "your_ANALYSIS_API_KEY" }
```

**Using Abacus AI Cron Job Tool:**
```
Name: "Broker AI Technical Analysis"
Schedule: "0 */15 * * *" (every 15 minutes)
Endpoint: /analysis/run
Method: POST
Payload: { "api_key": "your_ANALYSIS_API_KEY" }
Headers: { "Content-Type": "application/json" }
```

---

## 📡 API Endpoints

### Analysis
- **POST /analysis/run** - Execute technical analysis (called by cron)
  - Request: `{ "api_key": "string" }`
  - Response: `{ "success": boolean, "signals_generated": number }`

### Signals
- **GET /signals** - Get recent signals (query: `?limit=20`)
- **GET /signals/:symbol** - Get signals for specific symbol

### Orders
- **GET /orders** - Get all orders (query: `?limit=50`)
- **GET /orders/symbol/:symbol** - Get orders for symbol
- **POST /orders/:id/authorize** - Execute pending order
- **DELETE /orders/:id** - Cancel order

### Performance & P&L
- **GET /performance** - Get closed trades with P&L
- **GET /performance/symbol/:symbol** - P&L by symbol
- **GET /performance/stats/summary** - Overall statistics

### Configuration
- **GET /config** - Get all symbol configurations
- **GET /config/:symbol** - Get specific configuration
- **POST /config/:symbol** - Create/update configuration
- **POST /config/:symbol/disable** - Disable monitoring

### Telegram Webhook
- **POST /webhook/telegram** - Telegram updates (callback queries)

---

## 📊 How the System Works

### 1. Technical Analysis (Every 15 Minutes)
```
Cron Job Triggers /analysis/run
    ↓
Fetch market data from Alpaca (250 recent bars)
    ↓
Calculate indicators:
  • RSI (14 period)
  • MACD (12/26/9)
  • Moving Averages (50, 200)
  • Volume analysis
    ↓
Detect convergence (3+ indicators align)
    ↓
If signal generated:
  • Save to database
  • Send Telegram notification with buttons
```

### 2. User Authorization via Telegram
```
User receives signal notification
    ↓
Clicks BUY or SELL button
    ↓
Bot receives callback query
    ↓
/webhook/telegram processes it
    ↓
Create order in database
    ↓
Execute on Alpaca
    ↓
Send confirmation to user
    ↓
Start tracking P&L
```

### 3. Performance Tracking
```
BUY order executes
    ↓
Create performance record (OPEN status)
    ↓
Monitor price changes
    ↓
When SELL order executes:
  • Calculate P&L amount
  • Calculate P&L percentage
  • Calculate hold duration
  • Mark as CLOSED
```

---

## ⚙️ Configuration Parameters

Each symbol has customizable parameters:

```json
{
  "symbol": "AAPL",
  "enabled": true,
  "analysis_interval_min": 15,
  
  "rsi_period": 14,
  "rsi_overbought": 70,
  "rsi_oversold": 30,
  
  "macd_fast_period": 12,
  "macd_slow_period": 26,
  "macd_signal_period": 9,
  
  "ma50_period": 50,
  "ma200_period": 200,
  
  "volume_threshold_pct": 120,
  "required_convergence": 3
}
```

### Update Configuration
```bash
curl -X POST https://your-url/config/AAPL \
  -H "Content-Type: application/json" \
  -d '{
    "rsi_overbought": 75,
    "required_convergence": 4
  }'
```

---

## 🔔 Telegram Signal Format

When a signal is generated, you'll receive:

```
🟢 BUY Signal Generated!

📊 Symbol: AAPL
💵 Current Price: $150.25

📈 Technical Analysis:
  • RSI: 28.45 (Oversold)
  • MACD: -2.3450 (Below signal)
  • MA50: $151.00
  • MA200: $155.00

📝 Analysis:
RSI is oversold (<30); Price is below MA50

[✅ BUY] [❌ Cancel]
```

Click **✅ BUY** → Order executes on Alpaca

---

## 📈 Database Schema

All data is stored in PostgreSQL:

**Signals** - Technical analysis results
**Orders** - Buy/Sell order history
**Performance** - P&L tracking
**Configuration** - Symbol settings

Access data via API endpoints or directly via Prisma queries.

---

## 🧪 Testing

### Test Health Check
```bash
curl https://your-url/health
```

### Test Configuration
```bash
curl https://your-url/config
```

### Test Analysis (Manual Trigger)
```bash
curl -X POST https://your-url/analysis/run \
  -H "Content-Type: application/json" \
  -d '{"api_key": "your_ANALYSIS_API_KEY"}'
```

### View Signals Generated
```bash
curl https://your-url/signals?limit=10
```

---

## ⚠️ Important Notes

### Market Hours
- Alpaca live trading is during market hours (9:30 AM - 4:00 PM EST)
- Paper trading is available 24/7 (use paper trading account for testing)

### Rate Limiting
- Alpaca API has rate limits (~200 requests/minute)
- The cron job runs every 15 minutes (safe)
- If monitoring many symbols, adjust timing as needed

### P&L Calculation
- P&L = (Exit Price - Entry Price) × Quantity
- P&L % = ((Exit Price - Entry Price) / Entry Price) × 100
- Percentages are stored with 4 decimal precision

### Security
- API keys are stored securely in environment variables
- Always use HTTPS in production
- Protect your `ANALYSIS_API_KEY` from unauthorized cron calls

---

## 📚 API Documentation

Full interactive API documentation available at:
```
https://your-deployed-url/api-docs
```

All endpoints are documented with:
- Request/response examples
- Parameter descriptions
- Status codes

---

## 🆘 Troubleshooting

### Telegram Webhook Not Working
1. Verify webhook URL is accessible
2. Check `TELEGRAM_BOT_TOKEN` is correct
3. Verify bot has message permissions
4. Check server logs: `GET /prod logs`

### No Signals Generated
1. Ensure at least 250 price bars available
2. Check if 3+ indicators truly converge
3. Verify symbol exists on Alpaca
4. Check configuration is enabled

### Order Execution Fails
1. Verify Alpaca credentials are correct
2. Check account has sufficient buying power
3. Ensure market is open (if live trading)
4. Check order quantity is valid

### Performance Not Updating
1. Ensure SELL orders are created
2. Check performance records have both entry and exit prices
3. Run: `GET /performance/stats/summary` to verify

---

## 📞 Support

For issues, check:
1. API Documentation: `/api-docs`
2. Server Logs: Via Abacus AI console
3. Database queries: Via Prisma studio

---

## 🎓 Next Steps

1. ✅ Deploy the service (click Deploy button)
2. ✅ Configure environment variables
3. ✅ Register Telegram webhook
4. ✅ Set up 15-minute cron job
5. ✅ Enable monitoring for first symbol
6. ✅ Monitor first signal generation
7. ✅ Test order execution via Telegram

**You're ready to go live!** 🚀

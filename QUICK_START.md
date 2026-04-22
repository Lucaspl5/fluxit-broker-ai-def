# Quick Start Guide

## 5-Minute Setup

### 1. Get Credentials (5 min)

**Alpaca:**
- Go to https://alpaca.markets
- Sign up for paper trading account
- Create API key in dashboard
- Copy: ALPACA_API_KEY and ALPACA_SECRET_KEY

**Telegram:**
- Open Telegram, chat with @BotFather
- Send: /newbot
- Follow prompts, get TELEGRAM_BOT_TOKEN
- Send message to your bot
- Visit: https://api.telegram.org/bot{TOKEN}/getUpdates
- Find chat ID in response

**Security:**
- Run: openssl rand -hex 32
- Use output as ANALYSIS_API_KEY

---

## 2. Deploy (1 click)

- Click Deploy button in UI
- Copy your new URL: https://your-broker-xxxxx.abacusai.app

---

## 3. Configure (2 min)

In deployment settings, set environment variables:
```
ALPACA_API_KEY=your_key
ALPACA_SECRET_KEY=your_secret
TELEGRAM_BOT_TOKEN=your_token
TELEGRAM_CHAT_ID=your_id
ANALYSIS_API_KEY=your_secure_key
```

---

## 4. Register Telegram Webhook (30 sec)

```bash
curl -X POST https://api.telegram.org/bot{YOUR_TOKEN}/setWebhook \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-broker-xxxxx.abacusai.app/webhook/telegram"}'
```

---

## 5. Create Cron Job (1 min)

Use Abacus AI Cron Job tool with:
- Name: Broker AI Analysis
- Schedule: 0 */15 * * *
- Endpoint: /analysis/run
- Payload: {"api_key": "your_ANALYSIS_API_KEY"}

---

## 6. Enable First Symbol (30 sec)

```bash
curl -X POST https://your-broker-xxxxx.abacusai.app/config/AAPL \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}'
```

---

## Done!

Wait 15 minutes for first analysis run.

When signal generates:
- Get Telegram notification
- Click BUY/SELL button  
- Order executes on Alpaca
- P&L tracked in real-time

---

## Verify Installation

```bash
# Check API is up
curl https://your-broker-xxxxx.abacusai.app/health

# View config
curl https://your-broker-xxxxx.abacusai.app/config

# View API docs
https://your-broker-xxxxx.abacusai.app/api-docs
```

---

## Common Issues

**No signals?**
- Check if symbol is enabled: GET /config/AAPL
- Wait 15 minutes for cron
- Verify at least 250 price bars available

**Telegram not working?**
- Verify webhook URL is correct
- Check bot token is valid
- Ensure chat ID matches

**Order fails?**
- Verify Alpaca credentials
- Check account has buying power
- Ensure market is open (9:30-4:00 EST)

---

Your hybrid AI broker is running. It analyzes markets, you control trades.

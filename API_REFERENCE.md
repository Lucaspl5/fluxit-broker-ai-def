# API Reference

## Base URL
https://your-deployed-url

---

## Analysis Endpoints

### POST /analysis/run
Execute technical analysis for all enabled symbols.

Request:
```json
{
  "api_key": "your_ANALYSIS_API_KEY"
}
```

Response (200):
```json
{
  "success": true,
  "signals_generated": 2,
  "timestamp": "2024-04-20T10:27:00Z",
  "message": "Analysis completed. 2 signal(s) generated."
}
```

---

## Signal Endpoints

### GET /signals
Get recent trading signals.

Query Parameters:
- limit (number, default: 20)

Response:
```json
[
  {
    "id": "signal_123",
    "symbol": "AAPL",
    "signal_type": "BUY",
    "rsi": 28.45,
    "macd": -2.3450,
    "ma50": 151.20,
    "ma200": 155.80,
    "current_price": 150.25,
    "convergent_indicators": 4,
    "reasoning": "RSI oversold; MACD below signal line; Price below MA50",
    "timestamp": "2024-04-20T10:27:00Z"
  }
]
```

### GET /signals/:symbol
Get signals for a specific symbol.

Parameters:
- symbol (string) - Stock symbol
- limit (query, default: 20)

---

## Order Endpoints

### GET /orders
Get all orders.

Query Parameters:
- limit (number, default: 50)

Response:
```json
[
  {
    "id": "order_123",
    "symbol": "AAPL",
    "order_type": "BUY",
    "quantity": 10,
    "price": 150.25,
    "status": "EXECUTED",
    "alpaca_order_id": "alpaca_12345",
    "timestamp": "2024-04-20T10:27:00Z"
  }
]
```

### GET /orders/symbol/:symbol
Get orders for a symbol.

### POST /orders/:id/authorize
Authorize and execute a pending order.

Response:
```json
{
  "success": true,
  "message": "Order executed successfully"
}
```

### DELETE /orders/:id
Cancel an order.

---

## Performance Endpoints

### GET /performance
Get closed trades with P&L.

Response:
```json
[
  {
    "id": "perf_123",
    "symbol": "AAPL",
    "entry_price": 150.25,
    "exit_price": 155.50,
    "quantity": 10,
    "profit_loss": 52.50,
    "profit_loss_pct": 3.4783,
    "duration_seconds": 2685,
    "status": "CLOSED"
  }
]
```

### GET /performance/symbol/:symbol
Get P&L for specific symbol.

### GET /performance/stats/summary
Get overall performance statistics.

Response:
```json
{
  "total_trades": 25,
  "open_trades": 3,
  "winning_trades": 18,
  "losing_trades": 7,
  "win_rate": "72.00",
  "total_profit_loss": "1250.45",
  "avg_profit_loss_pct": "2.1450"
}
```

---

## Configuration Endpoints

### GET /config
Get all symbol configurations.

Response:
```json
[
  {
    "symbol": "AAPL",
    "enabled": true,
    "rsi_period": 14,
    "rsi_overbought": 70,
    "rsi_oversold": 30,
    "macd_fast_period": 12,
    "macd_slow_period": 26,
    "ma50_period": 50,
    "ma200_period": 200,
    "volume_threshold_pct": 120,
    "required_convergence": 3
  }
]
```

### GET /config/:symbol
Get configuration for a symbol.

### POST /config/:symbol
Create or update configuration.

Request Body (all optional):
```json
{
  "enabled": true,
  "rsi_period": 14,
  "rsi_overbought": 70,
  "rsi_oversold": 30,
  "required_convergence": 3
}
```

### POST /config/:symbol/disable
Disable monitoring for a symbol.

---

## Telegram Webhook

### POST /webhook/telegram
Handle Telegram callback queries (button clicks).

Callback Data Formats:
- order_buy_{signal_id}
- order_sell_{signal_id}
- cancel_{signal_id}

Response:
```json
{
  "success": true
}
```

---

## Health Check

### GET /health
Check API health status.

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-04-20T10:27:00Z"
}
```

### GET /
Get API information.

---

## Status Codes

- 200: Success
- 400: Bad request
- 404: Not found
- 500: Server error

---

## Error Response Format

```json
{
  "success": false,
  "error": "Error message",
  "timestamp": "2024-04-20T10:27:00Z"
}
```

---

Full interactive documentation: GET /api-docs

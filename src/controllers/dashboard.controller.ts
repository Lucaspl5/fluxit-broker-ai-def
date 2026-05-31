import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AlpacaService } from '../services/alpaca.service';

@Controller('dashboard')
export class DashboardController {
  constructor(
    private prisma: PrismaService,
    private alpaca: AlpacaService,
  ) {}

  @Get('data')
  async getData() {
    const [signals, orders, closedCount, account, configs, brokerPositions, portfolioHistory] = await Promise.all([
      this.prisma.signal.findMany({ orderBy: { timestamp: 'desc' }, take: 20 }),
      this.prisma.order.findMany({ orderBy: { timestamp: 'desc' }, take: 20 }),
      this.prisma.performance.count({ where: { status: 'CLOSED' } }),
      this.alpaca.getAccount(),
      this.prisma.configuration.findMany({ where: { enabled: true } }),
      this.alpaca.getPositions(),
      this.alpaca.getPortfolioHistory('3M', '1D'),
    ]);

    const INITIAL_CAPITAL = Number(process.env.INITIAL_CAPITAL ?? 100000);
    const equity = account ? Number(account.equity ?? 0) : null;

    // === Source of truth = Alpaca, not the DB ===
    // Unrealized P&L = sum of open positions' unrealized_pl from the broker
    const unrealizedPL = (brokerPositions ?? []).reduce((s: number, p: any) => s + Number(p.unrealized_pl ?? 0), 0);
    // Total P&L since inception = current equity vs the capital we started with
    const totalPL = equity != null ? equity - INITIAL_CAPITAL : 0;
    const realizedPL = totalPL - unrealizedPL;

    // Real equity curve from Alpaca portfolio history
    const equityCurve = (() => {
      if (!portfolioHistory?.timestamp?.length) return [] as { date: string; equity: number }[];
      const ts: number[] = portfolioHistory.timestamp;
      const eq: number[] = portfolioHistory.equity;
      return ts
        .map((t, i) => ({ date: new Date(t * 1000).toLocaleDateString('es-ES'), equity: parseFloat(Number(eq[i] ?? 0).toFixed(2)) }))
        .filter(p => p.equity > 0);
    })();

    return {
      summary: {
        closedTrades: closedCount,
        openTrades: (brokerPositions ?? []).length,
        totalPL: parseFloat(totalPL.toFixed(2)),
        realizedPL: parseFloat(realizedPL.toFixed(2)),
        unrealizedPL: parseFloat(unrealizedPL.toFixed(2)),
        equity: equity != null ? parseFloat(equity.toFixed(2)) : null,
        initialCapital: INITIAL_CAPITAL,
        buyingPower: account ? parseFloat(Number(account.buying_power ?? 0).toFixed(2)) : null,
        monitoredSymbols: configs.length,
      },
      equityCurve,
      brokerPositions: (brokerPositions ?? []).map((p: any) => ({
        symbol: p.symbol,
        qty: Number(p.qty),
        avgEntry: parseFloat(Number(p.avg_entry_price).toFixed(2)),
        currentPrice: parseFloat(Number(p.current_price ?? 0).toFixed(2)),
        unrealizedPL: parseFloat(Number(p.unrealized_pl ?? 0).toFixed(2)),
        marketValue: parseFloat(Number(p.market_value ?? 0).toFixed(2)),
      })),
      recentSignals: signals.map(s => ({
        id: s.id,
        symbol: s.symbol,
        type: s.signal_type,
        price: Number(s.current_price),
        rsi: Number(s.rsi),
        score: s.convergence_score,
        regime: s.regime_bullish,
        tfAlignment: s.tf_alignment,
        timestamp: s.timestamp,
      })),
      recentOrders: orders.map(o => ({
        id: o.id,
        symbol: o.symbol,
        type: o.order_type,
        qty: Number(o.quantity),
        price: Number(o.price),
        status: o.status,
        timestamp: o.timestamp,
      })),
    };
  }

  @Get()
  async serveHtml(@Res() res: Response) {
    res.setHeader('Content-Type', 'text/html');
    res.send(DASHBOARD_HTML);
  }
}

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Broker AI — Fluxit Dashboard</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; }
  header { background: #1e293b; padding: 1rem 2rem; display: flex; align-items: center; gap: 1rem; border-bottom: 1px solid #334155; }
  header h1 { font-size: 1.25rem; font-weight: 700; }
  .badge { background: #22c55e; color: #000; padding: 2px 8px; border-radius: 999px; font-size: 0.7rem; font-weight: 600; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1rem; padding: 1.5rem 2rem 0; }
  .card { background: #1e293b; border-radius: 12px; padding: 1.25rem; border: 1px solid #334155; }
  .card .label { font-size: 0.75rem; color: #94a3b8; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em; }
  .card .value { font-size: 1.75rem; font-weight: 700; }
  .card .value.green { color: #22c55e; }
  .card .value.red { color: #ef4444; }
  .card .value.blue { color: #60a5fa; }
  .section { padding: 1.5rem 2rem; }
  .section h2 { font-size: 0.9rem; font-weight: 600; color: #94a3b8; margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 0.05em; }
  .chart-wrap { background: #1e293b; border-radius: 12px; padding: 1.5rem; border: 1px solid #334155; max-height: 300px; }
  table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
  th { text-align: left; color: #64748b; font-weight: 500; padding: 0.5rem 0.75rem; border-bottom: 1px solid #334155; }
  td { padding: 0.5rem 0.75rem; border-bottom: 1px solid #1e293b; }
  tr:last-child td { border-bottom: none; }
  .pill { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 0.72rem; font-weight: 600; }
  .pill.buy  { background: #14532d; color: #4ade80; }
  .pill.sell { background: #450a0a; color: #f87171; }
  .pill.ok   { background: #1e3a5f; color: #60a5fa; }
  .pill.warn { background: #4a2415; color: #fb923c; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
  .tbl-wrap { background: #1e293b; border-radius: 12px; border: 1px solid #334155; overflow: hidden; }
  .refresh { margin-left: auto; background: #334155; border: none; color: #e2e8f0; padding: 6px 14px; border-radius: 8px; cursor: pointer; font-size: 0.8rem; }
  .refresh:hover { background: #475569; }
  @media (max-width: 768px) { .two-col { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<header>
  <span>📊</span>
  <h1>Broker AI — Fluxit</h1>
  <span class="badge">PAPER</span>
  <button class="refresh" onclick="loadData()">⟳ Actualizar</button>
</header>

<div class="grid" id="summary-cards">
  <div class="card"><div class="label">Equity (Alpaca)</div><div class="value blue" id="equity">—</div></div>
  <div class="card"><div class="label">P&L Total (real)</div><div class="value" id="total-pl">—</div></div>
  <div class="card"><div class="label">P&L No Realizado</div><div class="value" id="unrealized-pl">—</div></div>
  <div class="card"><div class="label">Trades Cerrados</div><div class="value blue" id="total-trades">—</div></div>
  <div class="card"><div class="label">Posiciones</div><div class="value blue" id="open-trades">—</div></div>
  <div class="card"><div class="label">Símbolos</div><div class="value blue" id="symbols">—</div></div>
</div>

<div class="section">
  <h2>Curva de Equity</h2>
  <div class="chart-wrap">
    <canvas id="equity-chart"></canvas>
  </div>
</div>

<div class="section two-col">
  <div>
    <h2>Señales recientes</h2>
    <div class="tbl-wrap">
      <table>
        <thead><tr><th>Símbolo</th><th>Tipo</th><th>Precio</th><th>RSI</th><th>Score</th><th>Régimen</th><th>Hora</th></tr></thead>
        <tbody id="signals-table"><tr><td colspan="7" style="text-align:center;color:#64748b">Cargando...</td></tr></tbody>
      </table>
    </div>
  </div>
  <div>
    <h2>Órdenes recientes</h2>
    <div class="tbl-wrap">
      <table>
        <thead><tr><th>Símbolo</th><th>Tipo</th><th>Qty</th><th>Precio</th><th>Estado</th></tr></thead>
        <tbody id="orders-table"><tr><td colspan="5" style="text-align:center;color:#64748b">Cargando...</td></tr></tbody>
      </table>
    </div>
  </div>
</div>

<div class="section">
  <h2>Posiciones abiertas</h2>
  <div class="tbl-wrap">
    <table>
      <thead><tr><th>Símbolo</th><th>Qty</th><th>Entrada Media</th><th>Precio Actual</th><th>P&L No Real.</th><th>Valor Mercado</th></tr></thead>
      <tbody id="positions-table"><tr><td colspan="6" style="text-align:center;color:#64748b">Cargando...</td></tr></tbody>
    </table>
  </div>
</div>

<script>
let equityChart = null;

async function loadData() {
  const r = await fetch('/dashboard/data');
  const d = await r.json();

  // Summary — all money figures come from Alpaca (source of truth)
  const pl  = d.summary.totalPL;
  const upl = d.summary.unrealizedPL;
  document.getElementById('equity').textContent    = d.summary.equity != null ? '$' + d.summary.equity.toLocaleString() : '—';
  document.getElementById('total-pl').textContent  = (pl >= 0 ? '+' : '') + '$' + pl.toFixed(2);
  document.getElementById('total-pl').className    = 'value ' + (pl >= 0 ? 'green' : 'red');
  document.getElementById('unrealized-pl').textContent = (upl >= 0 ? '+' : '') + '$' + upl.toFixed(2);
  document.getElementById('unrealized-pl').className   = 'value ' + (upl >= 0 ? 'green' : 'red');
  document.getElementById('total-trades').textContent = d.summary.closedTrades;
  document.getElementById('open-trades').textContent  = d.summary.openTrades;
  document.getElementById('symbols').textContent       = d.summary.monitoredSymbols;

  // Equity chart
  if (d.equityCurve.length > 0) {
    const ctx = document.getElementById('equity-chart').getContext('2d');
    const labels = d.equityCurve.map(e => e.date);
    const values = d.equityCurve.map(e => e.equity);
    if (equityChart) equityChart.destroy();
    equityChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{ label: 'Equity Alpaca ($)', data: values, borderColor: '#60a5fa', backgroundColor: 'rgba(96,165,250,0.08)', tension: 0.3, pointRadius: 3 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#94a3b8' } } }, scales: { x: { ticks: { color: '#64748b' }, grid: { color: '#1e293b' } }, y: { ticks: { color: '#64748b' }, grid: { color: '#334155' } } } }
    });
  }

  // Signals
  const sigBody = document.getElementById('signals-table');
  if (d.recentSignals.length === 0) {
    sigBody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#64748b">Sin señales</td></tr>';
  } else {
    sigBody.innerHTML = d.recentSignals.map(s => {
      const t = new Date(s.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      const pill = s.type === 'BUY' ? '<span class="pill buy">BUY</span>' : '<span class="pill sell">SELL</span>';
      const regime = s.regime == null ? '—' : s.regime ? '🐂' : '🐻';
      return \`<tr><td><b>\${s.symbol}</b></td><td>\${pill}</td><td>$\${s.price.toFixed(2)}</td><td>\${s.rsi.toFixed(1)}</td><td>\${s.score}/7</td><td>\${regime}</td><td>\${t}</td></tr>\`;
    }).join('');
  }

  // Orders
  const ordBody = document.getElementById('orders-table');
  if (d.recentOrders.length === 0) {
    ordBody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#64748b">Sin órdenes</td></tr>';
  } else {
    ordBody.innerHTML = d.recentOrders.map(o => {
      const pill  = o.type === 'BUY' ? '<span class="pill buy">BUY</span>' : '<span class="pill sell">SELL</span>';
      const spill = ['EXECUTED','AUTHORIZED'].includes(o.status) ? '<span class="pill ok">' + o.status + '</span>' : '<span class="pill warn">' + o.status + '</span>';
      return \`<tr><td><b>\${o.symbol}</b></td><td>\${pill}</td><td>\${o.qty}</td><td>$\${o.price.toFixed(2)}</td><td>\${spill}</td></tr>\`;
    }).join('');
  }

  // Positions — real open positions from Alpaca with live unrealized P&L
  const posBody = document.getElementById('positions-table');
  if (!d.brokerPositions || d.brokerPositions.length === 0) {
    posBody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#64748b">No hay posiciones abiertas</td></tr>';
  } else {
    posBody.innerHTML = d.brokerPositions.map(p => {
      const cls  = p.unrealizedPL >= 0 ? 'buy' : 'sell';
      const upl  = (p.unrealizedPL >= 0 ? '+' : '') + '$' + p.unrealizedPL.toFixed(2);
      return \`<tr><td><b>\${p.symbol}</b></td><td>\${p.qty}</td><td>$\${p.avgEntry.toFixed(2)}</td><td>$\${p.currentPrice.toFixed(2)}</td><td><span class="pill \${cls}">\${upl}</span></td><td>$\${p.marketValue.toFixed(2)}</td></tr>\`;
    }).join('');
  }
}

loadData();
setInterval(loadData, 60000); // auto-refresh every minute
</script>
</body>
</html>`;

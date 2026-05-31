import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AlpacaService } from './alpaca.service';
import Decimal from 'decimal.js';

interface Lot {
  qty: number;
  price: number;
  time: Date;
  orderId: string; // DB order id of the BUY that opened this lot
}

interface ClosedTrade {
  symbol: string;
  entryPrice: number;
  entryTime: Date;
  exitPrice: number;
  exitTime: Date;
  qty: number;
  pl: number;
  plPct: number;
  buyOrderId: string;
  sellOrderId: string;
}

interface OpenLot {
  symbol: string;
  entryPrice: number;
  entryTime: Date;
  qty: number;
  buyOrderId: string;
}

export interface ReconcileReport {
  source: 'alpaca-fills';
  fillsProcessed: number;
  realizedPL: number;
  closedTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  openLots: { symbol: string; qty: number; avgEntry: number }[];
  // Truth from the broker account itself
  account: {
    equity: number | null;
    lastEquity: number | null;
    cash: number | null;
    initialCapital: number;
    totalPLvsInitial: number | null;
  };
  brokerPositions: { symbol: string; qty: number; avgEntry: number; unrealizedPL: number; marketValue: number }[];
  // What the (corrupt) DB currently claims, for contrast
  dbClaim: { closedTrades: number; totalPL: number };
  applied: boolean;
}

const INITIAL_CAPITAL = Number(process.env.INITIAL_CAPITAL ?? 100000);

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    private prisma: PrismaService,
    private alpaca: AlpacaService,
  ) {}

  /**
   * Reconciles the local DB against Alpaca's real fill history.
   * dryRun=true → only returns the truthful report, no DB writes.
   * dryRun=false → wipes the corrupt order/performance tables and rebuilds them
   *                from real fills (FIFO matched), so per-trade analytics are real.
   */
  async reconcile(dryRun: boolean): Promise<ReconcileReport> {
    const [fills, account, brokerPositions] = await Promise.all([
      this.alpaca.getAllFillActivities(),
      this.alpaca.getAccount(),
      this.alpaca.getPositions(),
    ]);

    // Sort fills ascending by execution time (defensive — API already asc)
    fills.sort((a, b) => new Date(a.transaction_time).getTime() - new Date(b.transaction_time).getTime());

    // FIFO match buys against sells, per symbol
    const lots: Record<string, Lot[]> = {};
    const closed: ClosedTrade[] = [];

    for (const f of fills) {
      const symbol = f.symbol;
      const side = String(f.side).toLowerCase(); // 'buy' | 'sell'
      const price = Number(f.price);
      let qty = Math.abs(Number(f.qty));
      const time = new Date(f.transaction_time);
      const orderId = f.order_id;
      if (!symbol || !qty || !isFinite(price)) continue;

      if (!lots[symbol]) lots[symbol] = [];

      if (side === 'buy') {
        lots[symbol].push({ qty, price, time, orderId });
      } else if (side === 'sell') {
        // Consume open lots FIFO
        while (qty > 0 && lots[symbol].length > 0) {
          const lot = lots[symbol][0];
          const matched = Math.min(qty, lot.qty);
          const pl = (price - lot.price) * matched;
          const plPct = ((price - lot.price) / lot.price) * 100;
          closed.push({
            symbol,
            entryPrice: lot.price,
            entryTime: lot.time,
            exitPrice: price,
            exitTime: time,
            qty: matched,
            pl,
            plPct,
            buyOrderId: lot.orderId,
            sellOrderId: orderId,
          });
          lot.qty -= matched;
          qty -= matched;
          if (lot.qty <= 1e-9) lots[symbol].shift();
        }
        // qty left over with no matching lot = short / data gap → ignore for realized P&L
      }
    }

    const openLots: OpenLot[] = [];
    for (const symbol of Object.keys(lots)) {
      for (const lot of lots[symbol]) {
        if (lot.qty > 1e-9) {
          openLots.push({ symbol, entryPrice: lot.price, entryTime: lot.time, qty: lot.qty, buyOrderId: lot.orderId });
        }
      }
    }

    const realizedPL = closed.reduce((s, t) => s + t.pl, 0);
    const wins = closed.filter(t => t.pl > 0).length;
    const losses = closed.filter(t => t.pl < 0).length;

    // DB's current (corrupt) claim
    const dbClosed = await this.prisma.performance.findMany({ where: { status: 'CLOSED' } });
    const dbTotalPL = dbClosed.reduce((s, p) => s + Number(p.profit_loss ?? 0), 0);

    const equity = account ? Number(account.equity ?? 0) : null;
    const lastEquity = account ? Number(account.last_equity ?? 0) : null;
    const cash = account ? Number(account.cash ?? 0) : null;

    const report: ReconcileReport = {
      source: 'alpaca-fills',
      fillsProcessed: fills.length,
      realizedPL: round2(realizedPL),
      closedTrades: closed.length,
      wins,
      losses,
      winRate: closed.length ? round2((wins / closed.length) * 100) : 0,
      openLots: aggregateOpenLots(openLots),
      account: {
        equity: equity != null ? round2(equity) : null,
        lastEquity: lastEquity != null ? round2(lastEquity) : null,
        cash: cash != null ? round2(cash) : null,
        initialCapital: INITIAL_CAPITAL,
        totalPLvsInitial: equity != null ? round2(equity - INITIAL_CAPITAL) : null,
      },
      brokerPositions: (brokerPositions ?? []).map((p: any) => ({
        symbol: p.symbol,
        qty: Number(p.qty),
        avgEntry: round2(Number(p.avg_entry_price)),
        unrealizedPL: round2(Number(p.unrealized_pl ?? 0)),
        marketValue: round2(Number(p.market_value ?? 0)),
      })),
      dbClaim: { closedTrades: dbClosed.length, totalPL: round2(dbTotalPL) },
      applied: false,
    };

    if (dryRun) return report;

    // === APPLY: rebuild orders + performance from real fills ===
    await this.rebuildFromFills(fills, closed, openLots);
    report.applied = true;
    this.logger.warn(
      `Reconcile APPLIED: ${closed.length} real closed trades, realized=${round2(realizedPL)}, ${openLots.length} open lots`,
    );
    return report;
  }

  private async rebuildFromFills(fills: any[], closed: ClosedTrade[], openLots: OpenLot[]): Promise<void> {
    // Ensure a configuration exists for every traded symbol
    const symbols = [...new Set(fills.map(f => f.symbol))];
    const configBySymbol: Record<string, string> = {};
    for (const symbol of symbols) {
      const cfg = await this.prisma.configuration.upsert({
        where: { symbol },
        update: {},
        create: { symbol },
      });
      configBySymbol[symbol] = cfg.id;
    }

    await this.prisma.$transaction(async (tx) => {
      // Wipe corrupt bookkeeping (signals & configs are preserved)
      await tx.performance.deleteMany({});
      await tx.order.deleteMany({});

      // Recreate one real order per fill, keyed by Alpaca order_id + fill index
      const orderIdMap: Record<string, string> = {};
      for (let i = 0; i < fills.length; i++) {
        const f = fills[i];
        const symbol = f.symbol;
        const cfgId = configBySymbol[symbol];
        if (!cfgId) continue;
        const created = await tx.order.create({
          data: {
            configuration_id: cfgId,
            symbol,
            order_type: String(f.side).toLowerCase() === 'buy' ? 'BUY' : 'SELL',
            quantity: new Decimal(Math.abs(Number(f.qty))),
            price: new Decimal(Number(f.price)),
            max_risk_eur: new Decimal(0),
            status: 'EXECUTED',
            alpaca_order_id: f.order_id,
            execution_time: new Date(f.transaction_time),
            notes: 'Rebuilt from Alpaca fill',
          },
        });
        // Map the originating Alpaca order_id to a representative DB order id
        orderIdMap[`${f.order_id}:${i}`] = created.id;
        if (!orderIdMap[f.order_id]) orderIdMap[f.order_id] = created.id;
      }

      // Closed trades → CLOSED performance rows
      for (const t of closed) {
        const cfgId = configBySymbol[t.symbol];
        const buyOrderDbId = orderIdMap[t.buyOrderId];
        if (!cfgId || !buyOrderDbId) continue;
        await tx.performance.create({
          data: {
            configuration_id: cfgId,
            buy_order_id: buyOrderDbId,
            sell_order_id: orderIdMap[t.sellOrderId] ?? null,
            symbol: t.symbol,
            entry_price: new Decimal(t.entryPrice),
            entry_time: t.entryTime,
            exit_price: new Decimal(t.exitPrice),
            exit_time: t.exitTime,
            quantity: new Decimal(t.qty),
            profit_loss: new Decimal(t.pl),
            profit_loss_pct: new Decimal(t.plPct),
            duration_seconds: Math.max(0, Math.floor((t.exitTime.getTime() - t.entryTime.getTime()) / 1000)),
            status: 'CLOSED',
          },
        });
      }

      // Remaining open lots → OPEN performance rows
      for (const lot of openLots) {
        const cfgId = configBySymbol[lot.symbol];
        const buyOrderDbId = orderIdMap[lot.buyOrderId];
        if (!cfgId || !buyOrderDbId) continue;
        await tx.performance.create({
          data: {
            configuration_id: cfgId,
            buy_order_id: buyOrderDbId,
            symbol: lot.symbol,
            entry_price: new Decimal(lot.entryPrice),
            entry_time: lot.entryTime,
            quantity: new Decimal(lot.qty),
            status: 'OPEN',
          },
        });
      }
    }, { timeout: 120000 });
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function aggregateOpenLots(lots: OpenLot[]): { symbol: string; qty: number; avgEntry: number }[] {
  const bySym: Record<string, { qty: number; cost: number }> = {};
  for (const l of lots) {
    if (!bySym[l.symbol]) bySym[l.symbol] = { qty: 0, cost: 0 };
    bySym[l.symbol].qty += l.qty;
    bySym[l.symbol].cost += l.qty * l.entryPrice;
  }
  return Object.entries(bySym).map(([symbol, v]) => ({
    symbol,
    qty: round2(v.qty),
    avgEntry: v.qty ? round2(v.cost / v.qty) : 0,
  }));
}

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const symbols = [
  // Low risk — Blue Chip
  { symbol: 'MSFT', profile: 'BAJO', rsiOB: 75, rsiOS: 25, ma50: 50, ma200: 200, volThr: 110, tp: 3.5 },
  { symbol: 'JNJ',  profile: 'BAJO', rsiOB: 75, rsiOS: 25, ma50: 50, ma200: 200, volThr: 110, tp: 3.5 },
  { symbol: 'KO',   profile: 'BAJO', rsiOB: 75, rsiOS: 25, ma50: 50, ma200: 200, volThr: 110, tp: 3.5 },
  { symbol: 'PG',   profile: 'BAJO', rsiOB: 75, rsiOS: 25, ma50: 50, ma200: 200, volThr: 110, tp: 3.5 },
  { symbol: 'VZ',   profile: 'BAJO', rsiOB: 75, rsiOS: 25, ma50: 50, ma200: 200, volThr: 110, tp: 3.5 },
  { symbol: 'SPY',  profile: 'BAJO', rsiOB: 75, rsiOS: 25, ma50: 50, ma200: 200, volThr: 100, tp: 3.0 },
  // Medium risk — Tech Growth
  { symbol: 'NVDA',  profile: 'MEDIUM', rsiOB: 70, rsiOS: 30, ma50: 20, ma200: 200, volThr: 120, tp: 4.0 },
  { symbol: 'GOOGL', profile: 'MEDIUM', rsiOB: 70, rsiOS: 30, ma50: 20, ma200: 200, volThr: 120, tp: 4.0 },
  { symbol: 'AMZN',  profile: 'MEDIUM', rsiOB: 70, rsiOS: 30, ma50: 20, ma200: 200, volThr: 120, tp: 4.0 },
  { symbol: 'UNH',   profile: 'MEDIUM', rsiOB: 70, rsiOS: 30, ma50: 20, ma200: 200, volThr: 120, tp: 4.0 },
  // High risk — Volatile
  { symbol: 'TSLA', profile: 'ALTO', rsiOB: 65, rsiOS: 35, ma50: 20, ma200: 100, volThr: 150, tp: 5.0 },
  { symbol: 'META', profile: 'ALTO', rsiOB: 65, rsiOS: 35, ma50: 20, ma200: 100, volThr: 150, tp: 5.0 },
  { symbol: 'NFLX', profile: 'ALTO', rsiOB: 65, rsiOS: 35, ma50: 20, ma200: 100, volThr: 150, tp: 5.0 },
];

async function main() {
  console.log('Seeding 13 symbols...');

  for (const s of symbols) {
    const macdFast = s.profile === 'ALTO' ? 8 : 12;
    const macdSlow = s.profile === 'ALTO' ? 17 : 26;

    await prisma.configuration.upsert({
      where: { symbol: s.symbol },
      update: {},
      create: {
        symbol: s.symbol,
        enabled: true,
        risk_profile: s.profile as any,
        analysis_interval_min: 15,
        rsi_period: 14,
        rsi_overbought: s.rsiOB,
        rsi_oversold: s.rsiOS,
        macd_fast_period: macdFast,
        macd_slow_period: macdSlow,
        macd_signal_period: 9,
        ma50_period: s.ma50,
        ma200_period: s.ma200,
        volume_threshold_pct: s.volThr,
        required_convergence: 2,
        stop_loss_pct: 2.0,
        take_profit_pct: s.tp,
        max_risk_per_trade: 2.0,
      },
    });
    console.log(`  ${s.symbol} (${s.profile})`);
  }

  console.log('Done.');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });

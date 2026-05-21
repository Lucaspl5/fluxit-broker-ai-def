import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const symbols = [
  // Low risk — Blue Chip: SL 3% / TP 8% / convergence 2
  { symbol: 'MSFT', profile: 'BAJO',   rsiOB: 75, rsiOS: 25, ma50: 50, ma200: 200, volThr: 110, sl: 3.0, tp: 8.0,  conv: 2 },
  { symbol: 'JNJ',  profile: 'BAJO',   rsiOB: 75, rsiOS: 25, ma50: 50, ma200: 200, volThr: 110, sl: 3.0, tp: 8.0,  conv: 2 },
  { symbol: 'KO',   profile: 'BAJO',   rsiOB: 75, rsiOS: 25, ma50: 50, ma200: 200, volThr: 110, sl: 3.0, tp: 8.0,  conv: 2 },
  { symbol: 'PG',   profile: 'BAJO',   rsiOB: 75, rsiOS: 25, ma50: 50, ma200: 200, volThr: 110, sl: 3.0, tp: 8.0,  conv: 2 },
  { symbol: 'VZ',   profile: 'BAJO',   rsiOB: 75, rsiOS: 25, ma50: 50, ma200: 200, volThr: 110, sl: 3.0, tp: 8.0,  conv: 2 },
  { symbol: 'SPY',  profile: 'BAJO',   rsiOB: 75, rsiOS: 25, ma50: 50, ma200: 200, volThr: 100, sl: 3.0, tp: 7.0,  conv: 2 },
  // Medium risk — Tech Growth: SL 4% / TP 10% / convergence 2
  { symbol: 'NVDA',  profile: 'MEDIUM', rsiOB: 70, rsiOS: 30, ma50: 20, ma200: 200, volThr: 120, sl: 4.0, tp: 10.0, conv: 2 },
  { symbol: 'GOOGL', profile: 'MEDIUM', rsiOB: 70, rsiOS: 30, ma50: 20, ma200: 200, volThr: 120, sl: 4.0, tp: 10.0, conv: 2 },
  { symbol: 'AMZN',  profile: 'MEDIUM', rsiOB: 70, rsiOS: 30, ma50: 20, ma200: 200, volThr: 120, sl: 4.0, tp: 10.0, conv: 2 },
  { symbol: 'UNH',   profile: 'MEDIUM', rsiOB: 70, rsiOS: 30, ma50: 20, ma200: 200, volThr: 120, sl: 4.0, tp: 10.0, conv: 2 },
  // High risk — Volatile: SL 6% / TP 15% / convergence 3
  { symbol: 'TSLA', profile: 'ALTO',   rsiOB: 65, rsiOS: 35, ma50: 20, ma200: 100, volThr: 150, sl: 6.0, tp: 15.0, conv: 3 },
  { symbol: 'META', profile: 'ALTO',   rsiOB: 65, rsiOS: 35, ma50: 20, ma200: 100, volThr: 150, sl: 6.0, tp: 15.0, conv: 3 },
  { symbol: 'NFLX', profile: 'ALTO',   rsiOB: 65, rsiOS: 35, ma50: 20, ma200: 100, volThr: 150, sl: 6.0, tp: 15.0, conv: 3 },
];

async function main() {
  console.log('Seeding 13 symbols with updated risk parameters...');

  for (const s of symbols) {
    const macdFast = s.profile === 'ALTO' ? 8 : 12;
    const macdSlow = s.profile === 'ALTO' ? 17 : 26;

    const riskData = {
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
      required_convergence: s.conv,
      stop_loss_pct: s.sl,
      take_profit_pct: s.tp,
      max_risk_per_trade: 5.0,
    };

    await prisma.configuration.upsert({
      where:  { symbol: s.symbol },
      update: riskData,
      create: { symbol: s.symbol, ...riskData },
    });
    console.log(`  ${s.symbol} (${s.profile}): SL ${s.sl}% / TP ${s.tp}% / conv ${s.conv}`);
  }

  console.log('Done. Risk parameters updated.');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });

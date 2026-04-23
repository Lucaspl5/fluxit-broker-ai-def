import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database with 13 symbols...');

  // Blue Chip stocks (BAJO/LOW RISK)
  const blueChips = [
    { symbol: 'MSFT', name: 'Microsoft', profile: 'BAJO' },
    { symbol: 'JNJ', name: 'Johnson & Johnson', profile: 'BAJO' },
    { symbol: 'KO', name: 'Coca-Cola', profile: 'BAJO' },
    { symbol: 'PG', name: 'Procter & Gamble', profile: 'BAJO' },
    { symbol: 'VZ', name: 'Verizon', profile: 'BAJO' },
  ];

  // Tech Growth (MEDIUM RISK)
  const techGrowth = [
    { symbol: 'NVDA', name: 'Nvidia', profile: 'MEDIUM' },
    { symbol: 'GOOGL', name: 'Google', profile: 'MEDIUM' },
    { symbol: 'AMZN', name: 'Amazon', profile: 'MEDIUM' },
    { symbol: 'UNH', name: 'UnitedHealth', profile: 'MEDIUM' },
  ];

  // High Volatility (ALTO/HIGH RISK)
  const highVol = [
    { symbol: 'TSLA', name: 'Tesla', profile: 'ALTO' },
    { symbol: 'META', name: 'Meta', profile: 'ALTO' },
    { symbol: 'NFLX', name: 'Netflix', profile: 'ALTO' },
  ];

  // ETF (BAJO/LOW RISK)
  const etf = [{ symbol: 'SPY', name: 'S&P 500 ETF', profile: 'BAJO' }];

  const allSymbols = [...blueChips, ...techGrowth, ...highVol, ...etf];

  for (const s of allSymbols) {
    let config: any = {
      enabled: true,
      risk_profile: s.profile,
      analysis_interval_min: 15,
      required_convergence: 4, // 4/4 indicators required (strict)
      stop_loss_pct: 2.0, // -2%
      max_risk_per_trade: 2.0, // Max €2 per trade
    };

    // Blue Chip configuration
    if (s.profile === 'BAJO') {
      config = {
        ...config,
        rsi_period: 14,
        rsi_overbought: 75,
        rsi_oversold: 25,
        macd_fast_period: 12,
        macd_slow_period: 26,
        macd_signal_period: 9,
        ma50_period: 50,
        ma200_period: 200,
        volume_threshold_pct: 110, // Less demanding
        take_profit_pct: 3.5, // +3.5% target
      };
    }

    // Tech Growth configuration
    if (s.profile === 'MEDIUM') {
      config = {
        ...config,
        rsi_period: 14,
        rsi_overbought: 70,
        rsi_oversold: 30,
        macd_fast_period: 12,
        macd_slow_period: 26,
        macd_signal_period: 9,
        ma50_period: 20,
        ma200_period: 200,
        volume_threshold_pct: 120, // Standard
        take_profit_pct: 4.0, // +4% target
      };
    }

    // High Volatility configuration
    if (s.profile === 'ALTO') {
      config = {
        ...config,
        rsi_period: 14,
        rsi_overbought: 65,
        rsi_oversold: 35,
        macd_fast_period: 8,
        macd_slow_period: 17,
        macd_signal_period: 9,
        ma50_period: 20,
        ma200_period: 100,
        volume_threshold_pct: 150, // More demanding
        take_profit_pct: 5.0, // +5% target (higher reward for higher risk)
      };
    }

    // ETF is same as Blue Chip but with less volume importance
    if (s.symbol === 'SPY') {
      config = {
        ...config,
        rsi_period: 14,
        rsi_overbought: 75,
        rsi_oversold: 25,
        macd_fast_period: 12,
        macd_slow_period: 26,
        macd_signal_period: 9,
        ma50_period: 50,
        ma200_period: 200,
        volume_threshold_pct: 100, // Less important for ETF
        take_profit_pct: 3.0, // +3% target
      };
    }

    await prisma.configuration.upsert({
      where: { symbol: s.symbol },
      update: config,
      create: {
        symbol: s.symbol,
        ...config,
      },
    });

    console.log(`✅ ${s.symbol} (${s.name}) - Risk: ${s.profile}`);
  }

  console.log('\n🎯 Database seeded successfully!');
  console.log('\n📊 Symbols configured:');
  console.log('   🟢 LOW RISK (Blue Chip): MSFT, JNJ, KO, PG, VZ, SPY');
  console.log('   🟡 MEDIUM RISK (Tech): NVDA, GOOGL, AMZN, UNH');
  console.log('   🟠 HIGH RISK (Volatile): TSLA, META, NFLX');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

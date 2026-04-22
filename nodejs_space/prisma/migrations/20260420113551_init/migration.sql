-- CreateEnum
CREATE TYPE "SignalType" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'AUTHORIZED', 'EXECUTED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PerformanceStatus" AS ENUM ('OPEN', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RiskProfile" AS ENUM ('BAJO', 'MEDIUM', 'ALTO');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "configuration" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "risk_profile" "RiskProfile" NOT NULL DEFAULT 'MEDIUM',
    "analysis_interval_min" INTEGER NOT NULL DEFAULT 15,
    "rsi_period" INTEGER NOT NULL DEFAULT 14,
    "rsi_overbought" INTEGER NOT NULL DEFAULT 70,
    "rsi_oversold" INTEGER NOT NULL DEFAULT 30,
    "macd_fast_period" INTEGER NOT NULL DEFAULT 12,
    "macd_slow_period" INTEGER NOT NULL DEFAULT 26,
    "macd_signal_period" INTEGER NOT NULL DEFAULT 9,
    "ma50_period" INTEGER NOT NULL DEFAULT 50,
    "ma200_period" INTEGER NOT NULL DEFAULT 200,
    "volume_threshold_pct" DECIMAL(65,30) NOT NULL DEFAULT 120,
    "required_convergence" INTEGER NOT NULL DEFAULT 4,
    "stop_loss_pct" DECIMAL(65,30) NOT NULL DEFAULT 2.0,
    "take_profit_pct" DECIMAL(65,30) NOT NULL DEFAULT 4.0,
    "max_risk_per_trade" DECIMAL(65,30) NOT NULL DEFAULT 2.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signal" (
    "id" TEXT NOT NULL,
    "configuration_id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "symbol" VARCHAR(10) NOT NULL,
    "signal_type" "SignalType" NOT NULL,
    "rsi" DECIMAL(5,2) NOT NULL,
    "macd" DECIMAL(10,4) NOT NULL,
    "macd_signal" DECIMAL(10,4) NOT NULL,
    "macd_divergence" DECIMAL(10,4),
    "ma50" DECIMAL(12,4) NOT NULL,
    "ma200" DECIMAL(12,4) NOT NULL,
    "current_price" DECIMAL(12,4) NOT NULL,
    "volume" BIGINT NOT NULL,
    "avg_volume" BIGINT NOT NULL,
    "volume_ratio" DECIMAL(8,2) NOT NULL,
    "convergent_indicators" INTEGER NOT NULL,
    "convergence_score" INTEGER NOT NULL,
    "confidence_level" DECIMAL(5,2) NOT NULL,
    "risk_level" "RiskLevel" NOT NULL,
    "reasoning" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "telegram_message_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order" (
    "id" TEXT NOT NULL,
    "configuration_id" TEXT NOT NULL,
    "signal_id" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "symbol" VARCHAR(10) NOT NULL,
    "order_type" "OrderType" NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "price" DECIMAL(12,4) NOT NULL,
    "stop_loss_price" DECIMAL(12,4),
    "take_profit_price" DECIMAL(12,4),
    "max_risk_eur" DECIMAL(10,4) NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "status_reason" TEXT,
    "risk_level" "RiskLevel",
    "alpaca_order_id" TEXT,
    "user_authorization_time" TIMESTAMP(3),
    "execution_time" TIMESTAMP(3),
    "telegram_callback_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance" (
    "id" TEXT NOT NULL,
    "configuration_id" TEXT NOT NULL,
    "buy_order_id" TEXT NOT NULL,
    "sell_order_id" TEXT,
    "signal_id" TEXT,
    "symbol" VARCHAR(10) NOT NULL,
    "entry_price" DECIMAL(12,4) NOT NULL,
    "entry_time" TIMESTAMP(3) NOT NULL,
    "exit_price" DECIMAL(12,4),
    "exit_time" TIMESTAMP(3),
    "quantity" DECIMAL(10,2) NOT NULL,
    "profit_loss" DECIMAL(12,4),
    "profit_loss_pct" DECIMAL(8,4),
    "duration_seconds" INTEGER,
    "status" "PerformanceStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "riskMetrics" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "trades_today" INTEGER NOT NULL DEFAULT 0,
    "losses_today" INTEGER NOT NULL DEFAULT 0,
    "total_daily_loss_eur" DECIMAL(10,4) NOT NULL,
    "last_trade_time" TIMESTAMP(3),
    "blacklist_until" TIMESTAMP(3),
    "is_blacklisted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "riskMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "configuration_symbol_key" ON "configuration"("symbol");

-- CreateIndex
CREATE INDEX "configuration_enabled_idx" ON "configuration"("enabled");

-- CreateIndex
CREATE INDEX "configuration_risk_profile_idx" ON "configuration"("risk_profile");

-- CreateIndex
CREATE INDEX "signal_symbol_idx" ON "signal"("symbol");

-- CreateIndex
CREATE INDEX "signal_timestamp_idx" ON "signal"("timestamp");

-- CreateIndex
CREATE INDEX "signal_signal_type_idx" ON "signal"("signal_type");

-- CreateIndex
CREATE INDEX "signal_confidence_level_idx" ON "signal"("confidence_level");

-- CreateIndex
CREATE INDEX "order_symbol_idx" ON "order"("symbol");

-- CreateIndex
CREATE INDEX "order_status_idx" ON "order"("status");

-- CreateIndex
CREATE INDEX "order_timestamp_idx" ON "order"("timestamp");

-- CreateIndex
CREATE INDEX "order_risk_level_idx" ON "order"("risk_level");

-- CreateIndex
CREATE INDEX "performance_symbol_idx" ON "performance"("symbol");

-- CreateIndex
CREATE INDEX "performance_status_idx" ON "performance"("status");

-- CreateIndex
CREATE INDEX "performance_entry_time_idx" ON "performance"("entry_time");

-- CreateIndex
CREATE INDEX "riskMetrics_is_blacklisted_idx" ON "riskMetrics"("is_blacklisted");

-- CreateIndex
CREATE UNIQUE INDEX "riskMetrics_date_key" ON "riskMetrics"("date");

-- AddForeignKey
ALTER TABLE "signal" ADD CONSTRAINT "signal_configuration_id_fkey" FOREIGN KEY ("configuration_id") REFERENCES "configuration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_configuration_id_fkey" FOREIGN KEY ("configuration_id") REFERENCES "configuration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_signal_id_fkey" FOREIGN KEY ("signal_id") REFERENCES "signal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance" ADD CONSTRAINT "performance_configuration_id_fkey" FOREIGN KEY ("configuration_id") REFERENCES "configuration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance" ADD CONSTRAINT "performance_buy_order_id_fkey" FOREIGN KEY ("buy_order_id") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance" ADD CONSTRAINT "performance_signal_id_fkey" FOREIGN KEY ("signal_id") REFERENCES "signal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

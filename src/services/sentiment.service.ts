import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

interface SentimentResult {
  score: number;      // -1 (very bearish) to +1 (very bullish)
  label: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  articleCount: number;
  summary: string;
}

const BULLISH_TERMS = [
  'beat', 'beats', 'surpasses', 'exceeds', 'record', 'high', 'growth', 'profit',
  'upgrade', 'buy', 'strong', 'outperform', 'bullish', 'rally', 'surge', 'gains',
  'positive', 'optimistic', 'breakthrough', 'expansion', 'acquisition',
];

const BEARISH_TERMS = [
  'miss', 'misses', 'disappoints', 'below', 'loss', 'losses', 'decline', 'falls',
  'downgrade', 'sell', 'weak', 'underperform', 'bearish', 'crash', 'drops', 'plunge',
  'negative', 'pessimistic', 'layoffs', 'recall', 'investigation', 'lawsuit', 'fraud',
  'bankruptcy', 'default', 'warning', 'risk',
];

// Simple keyword-based scoring — no external ML needed
function scoreText(text: string): number {
  const lower = text.toLowerCase();
  let score = 0;
  for (const t of BULLISH_TERMS) if (lower.includes(t)) score += 1;
  for (const t of BEARISH_TERMS) if (lower.includes(t)) score -= 1;
  return score;
}

@Injectable()
export class SentimentService {
  private readonly logger = new Logger(SentimentService.name);
  private readonly apiKey = process.env.NEWS_API_KEY;

  // Cache: symbol -> { result, fetchedAt }
  private cache = new Map<string, { result: SentimentResult; fetchedAt: number }>();
  private readonly cacheTtlMs = 30 * 60 * 1000; // 30 min

  async getSentiment(symbol: string): Promise<SentimentResult> {
    if (!this.apiKey) {
      return { score: 0, label: 'NEUTRAL', articleCount: 0, summary: 'NEWS_API_KEY not configured' };
    }

    const cached = this.cache.get(symbol);
    if (cached && Date.now() - cached.fetchedAt < this.cacheTtlMs) {
      return cached.result;
    }

    try {
      const url = `https://newsapi.org/v2/everything`;
      const response = await axios.get(url, {
        params: {
          q: symbol,
          language: 'en',
          sortBy: 'publishedAt',
          pageSize: 20,
          apiKey: this.apiKey,
        },
        timeout: 5000,
      });

      const articles: any[] = response.data?.articles ?? [];
      if (articles.length === 0) {
        const result: SentimentResult = { score: 0, label: 'NEUTRAL', articleCount: 0, summary: 'No recent news' };
        this.cache.set(symbol, { result, fetchedAt: Date.now() });
        return result;
      }

      let totalScore = 0;
      for (const article of articles) {
        const text = `${article.title ?? ''} ${article.description ?? ''}`;
        totalScore += scoreText(text);
      }

      const avgScore = totalScore / articles.length;
      // Normalize to -1..+1
      const normalizedScore = Math.max(-1, Math.min(1, avgScore / 3));

      const label: SentimentResult['label'] =
        normalizedScore > 0.15 ? 'BULLISH' : normalizedScore < -0.15 ? 'BEARISH' : 'NEUTRAL';

      const result: SentimentResult = {
        score: parseFloat(normalizedScore.toFixed(3)),
        label,
        articleCount: articles.length,
        summary: `${articles.length} artículos · ${label} (score: ${normalizedScore.toFixed(2)})`,
      };

      this.cache.set(symbol, { result, fetchedAt: Date.now() });
      this.logger.log(`Sentiment ${symbol}: ${label} (${normalizedScore.toFixed(2)}) from ${articles.length} articles`);
      return result;
    } catch (error) {
      this.logger.warn(`Sentiment fetch failed for ${symbol}: ${error.message}`);
      return { score: 0, label: 'NEUTRAL', articleCount: 0, summary: `Error: ${error.message}` };
    }
  }

  // Returns true if sentiment is too negative to trade (bearish with score < -0.3)
  isSentimentBlocking(result: SentimentResult): boolean {
    return result.label === 'BEARISH' && result.score < -0.3;
  }
}

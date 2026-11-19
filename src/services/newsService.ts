import Parser from 'rss-parser';
import { News, INews } from '../models/News.js';

interface CustomFeedItem {
  title?: string;
  link?: string;
  pubDate?: string;
  content?: string;
  contentSnippet?: string;
  enclosure?: { url: string };
  'media:content'?: { $: { url: string } };
}

class NewsService {
  private parser: Parser<any, CustomFeedItem>;
  private feedSources = [
    {
      name: 'Anime News Network',
      url: 'https://www.animenewsnetwork.com/all/rss.xml?ann-edition=w',
    },
    {
      name: 'Anime Corner',
      url: 'https://animecorner.me/feed/',
    },
    {
      name: 'Crunchyroll News',
      url: 'https://cr-news-api-service.prd.crunchyrollsvc.com/v1/en-US/rss',
    },
  ];

  constructor() {
    this.parser = new Parser({
      customFields: {
        item: [
          ['media:content', 'media:content'],
          ['enclosure', 'enclosure'],
        ],
      },
    });
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private extractImageUrl(item: any): string | null {
    // 1. Enclosure check
    if (item.enclosure?.url) {
      return item.enclosure.url;
    }
    // 2. Media:content check
    if (item['media:content']?.['$']?.url) {
      return item['media:content']['$'].url;
    }
    if (typeof item['media:content'] === 'string') {
      return item['media:content'];
    }
    // 3. RegEx parse from content or description
    const content = item.content || item['content:encoded'] || item.description || '';
    const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch && imgMatch[1]) {
      return imgMatch[1];
    }

    return null;
  }

  /**
   * Syncs RSS feeds into MongoDB with 60-day auto-purge TTL
   */
  async syncFeeds(): Promise<{ synced: number; skipped: number }> {
    let synced = 0;
    let skipped = 0;

    for (const source of this.feedSources) {
      try {
        const feed = await this.parser.parseURL(source.url);
        if (!feed?.items) continue;

        for (const item of feed.items.slice(0, 20)) {
          if (!item.title || !item.link) continue;

          const baseSlug = this.slugify(item.title);
          if (!baseSlug) continue;

          // Check if already exists by slug or link
          const existing = await News.findOne({
            $or: [{ slug: baseSlug }, { sourceUrl: item.link }],
          });

          if (existing) {
            skipped++;
            continue;
          }

          const imageUrl = this.extractImageUrl(item);
          // Dual Category Rule:
          // Images Present -> 'news'
          // No Images -> 'article'
          const category: 'news' | 'article' = imageUrl ? 'news' : 'article';

          const publishedDate = item.pubDate ? new Date(item.pubDate) : new Date();

          await News.create({
            title: item.title,
            slug: `${baseSlug}-${Date.now().toString(36)}`,
            snippet: item.contentSnippet?.slice(0, 300) || '',
            content: item.content || item.contentSnippet || '',
            imageUrl,
            category,
            sourceName: source.name,
            sourceUrl: item.link,
            tags: ['Anime', category],
            publishedAt: isNaN(publishedDate.getTime()) ? new Date() : publishedDate,
            createdAt: new Date(),
          });

          synced++;
        }
      } catch (err: any) {
        console.warn(`[News Sync Error] Failed fetching ${source.name}:`, err.message);
      }
    }

    return { synced, skipped };
  }

  /**
   * Get latest news (with images)
   */
  async getNews(limit = 20, page = 1) {
    const skip = (page - 1) * limit;
    return News.find({ category: 'news' })
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
  }

  /**
   * Get latest editorial articles / text-only digests
   */
  async getArticles(limit = 20, page = 1) {
    const skip = (page - 1) * limit;
    return News.find({ category: 'article' })
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
  }
}

export const newsService = new NewsService();

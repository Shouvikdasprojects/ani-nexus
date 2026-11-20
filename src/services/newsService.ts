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
  'media:thumbnail'?: { $: { url: string } } | { url: string };
  'content:encoded'?: string;
  mediaContent?: { $: { url: string } } | { url: string };
  mediaThumbnail?: { $: { url: string } } | { url: string };
  contentEncoded?: string;
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
          ['media:content', 'mediaContent'],
          ['media:thumbnail', 'mediaThumbnail'],
          ['content:encoded', 'contentEncoded'],
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
    const mc = item.mediaContent || item['media:content'];
    if (mc?.['$']?.url) {
      return mc['$'].url;
    }
    if (typeof mc === 'string') {
      return mc;
    }
    // 3. Media:thumbnail check (Crunchyroll News & others)
    const mt = item.mediaThumbnail || item['media:thumbnail'];
    if (mt?.['$']?.url) {
      return mt['$'].url;
    }
    if (mt?.url) {
      return mt.url;
    }
    if (typeof mt === 'string') {
      return mt;
    }
    // 4. RegEx parse from contentEncoded, content or description (Anime Corner, ANN)
    const htmlContent = item.contentEncoded || item['content:encoded'] || item.content || item.description || '';
    const imgMatch = htmlContent.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch && imgMatch[1]) {
      return imgMatch[1];
    }

    return null;
  }

  /**
   * Syncs RSS feeds into MongoDB with 60-day auto-purge TTL
   */
  async syncFeeds(): Promise<{ synced: number; skipped: number; upgraded: number }> {
    let synced = 0;
    let skipped = 0;
    let upgraded = 0;

    for (const source of this.feedSources) {
      try {
        const feed = await this.parser.parseURL(source.url);
        if (!feed?.items) continue;

        for (const item of feed.items.slice(0, 25)) {
          if (!item.title || !item.link) continue;

          const baseSlug = this.slugify(item.title);
          if (!baseSlug) continue;

          const imageUrl = this.extractImageUrl(item);
          const category: 'news' | 'article' = imageUrl ? 'news' : 'article';

          // Check if already exists by sourceUrl or exact title
          const existing = await News.findOne({
            $or: [{ sourceUrl: item.link }, { title: item.title }],
          });

          if (existing) {
            // Retroactively upgrade article to news if image is now discovered
            if (imageUrl && (!existing.imageUrl || existing.category === 'article')) {
              await News.updateOne(
                { _id: existing._id },
                { $set: { imageUrl, category: 'news', tags: ['Anime', 'news'] } }
              );
              upgraded++;
            }
            skipped++;
            continue;
          }

          const publishedDate = item.pubDate ? new Date(item.pubDate) : new Date();
          const hash = Buffer.from(item.link).toString('base64url').slice(-6);

          await News.create({
            title: item.title,
            slug: `${baseSlug}-${hash}`,
            snippet: item.contentSnippet?.slice(0, 300) || '',
            content: item.contentEncoded || item.content || item.contentSnippet || '',
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

    return { synced, skipped, upgraded };
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

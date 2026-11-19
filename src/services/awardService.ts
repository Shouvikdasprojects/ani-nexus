import { Award, IAward } from '../models/Award.js';

export interface RollingWindowInfo {
  latestYear: number;
  cutoffYear: number;
  retainedYears: number[];
  retentionPolicy: string;
}

export class AwardService {
  /**
   * Enforces the 5-Year Rolling Window Retention Policy:
   * Keeps the latest active award year + the past 5 years (total 6 editions).
   * Automatically deletes any edition older than (latestYear - 5).
   */
  async pruneOutdatedAwards(): Promise<{ deletedCount: number; window: RollingWindowInfo }> {
    const latestDoc = await Award.findOne().sort({ year: -1 }).select('year').lean();
    const currentCalendarYear = new Date().getFullYear();
    const latestYear = latestDoc ? Math.max(latestDoc.year, currentCalendarYear) : currentCalendarYear;

    // Latest year + past 5 years = 6 years retained (e.g. 2026, 2025, 2024, 2023, 2022, 2021)
    const cutoffYear = latestYear - 5;

    // Delete any edition older than cutoffYear (6th year and older)
    const deleteResult = await Award.deleteMany({ year: { $lt: cutoffYear } });

    const retainedYears: number[] = [];
    for (let y = latestYear; y >= cutoffYear; y--) {
      retainedYears.push(y);
    }

    const window: RollingWindowInfo = {
      latestYear,
      cutoffYear,
      retainedYears,
      retentionPolicy: `Active/Latest Year (${latestYear}) + Past 5 Years (${cutoffYear} to ${latestYear - 1}). 6th year and older are automatically purged.`,
    };

    if (deleteResult.deletedCount > 0) {
      console.log(`🧹 [Award Retention Policy]: Auto-purged ${deleteResult.deletedCount} outdated award records older than ${cutoffYear}.`);
    }

    return {
      deletedCount: deleteResult.deletedCount || 0,
      window,
    };
  }

  /**
   * Get list of all available award years and editions currently retained
   */
  async getOverview() {
    // Run pruning to ensure database stays clean
    await this.pruneOutdatedAwards();

    const awards = await Award.find()
      .sort({ year: -1 })
      .select('awardName edition year slug status ceremonyDate totalCategories bannerImage')
      .lean();

    const latestDoc = awards[0];
    const latestYear = latestDoc ? latestDoc.year : new Date().getFullYear();
    const cutoffYear = latestYear - 5;

    const availableYears = [...new Set(awards.map((a) => a.year))].sort((a, b) => b - a);

    return {
      latestYear,
      cutoffYear,
      retentionWindow: `${cutoffYear} - ${latestYear} (Latest Year + Past 5 Years)`,
      totalEditions: awards.length,
      availableYears,
      editions: awards,
    };
  }

  /**
   * Get complete awards data for the latest year
   */
  async getLatestAwards() {
    await this.pruneOutdatedAwards();
    const latest = await Award.findOne().sort({ year: -1 }).lean();
    return latest;
  }

  /**
   * Get awards data for a specific year
   */
  async getAwardsByYear(year: number) {
    const latestDoc = await Award.findOne().sort({ year: -1 }).select('year').lean();
    const latestYear = latestDoc ? latestDoc.year : new Date().getFullYear();
    const cutoffYear = latestYear - 5;

    if (year < cutoffYear) {
      return {
        status: 'purged',
        message: `Award data for year ${year} has been auto-purged per the 5-year rolling retention policy. Currently retaining ${cutoffYear} to ${latestYear}.`,
        cutoffYear,
        latestYear,
      };
    }

    const awards = await Award.find({ year }).lean();
    return awards;
  }

  /**
   * Get historical winners & nominees across all active years for a specific category
   * e.g. "anime-of-the-year", "best-animation", "best-action"
   */
  async getCategoryHistory(categorySlug: string) {
    await this.pruneOutdatedAwards();

    const normalizedSlug = categorySlug.toLowerCase().trim();
    const awards = await Award.find().sort({ year: -1 }).lean();

    const history = [];

    for (const award of awards) {
      const cat = award.categories.find(
        (c) =>
          c.slug.toLowerCase() === normalizedSlug ||
          c.name.toLowerCase().replace(/[^a-z0-9]/g, '-') === normalizedSlug
      );

      if (cat) {
        history.push({
          year: award.year,
          edition: award.edition,
          awardName: award.awardName,
          categoryName: cat.name,
          categorySlug: cat.slug,
          description: cat.description,
          winner: cat.winner,
          nominees: cat.nominees,
        });
      }
    }

    return {
      categorySlug: normalizedSlug,
      totalYearsFound: history.length,
      history,
    };
  }

  /**
   * Insert or update an award and trigger 5-year rolling purge
   */
  async upsertAward(data: Partial<IAward>) {
    if (!data.year || !data.edition) {
      throw new Error('Year and edition are required to save an award.');
    }

    const slug = data.slug || `crunchyroll-anime-awards-${data.year}`;
    const totalCategories = data.categories ? data.categories.length : 0;

    const doc = await Award.findOneAndUpdate(
      { year: data.year, awardName: data.awardName || 'Crunchyroll Anime Awards' },
      {
        ...data,
        slug,
        totalCategories,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Auto-prune any data older than (latestYear - 5)
    await this.pruneOutdatedAwards();

    return doc;
  }
}

export const awardService = new AwardService();

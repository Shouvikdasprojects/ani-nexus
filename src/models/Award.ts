import mongoose, { Schema, Document } from 'mongoose';

export interface IAwardNominee {
  title: {
    english: string;
    romaji?: string;
    native?: string;
  };
  franchiseSlug?: string;
  anilistId?: number;
  malId?: number;
  imageUrl?: string;
  nomineeName?: string; // Character name, voice actor, director, or song title
  details?: string;     // Additional info e.g. "Sung by Creepy Nuts" or "Studio MAPPA"
  isWinner: boolean;
}

export interface IAwardCategory {
  name: string;
  slug: string;
  description?: string;
  winner?: IAwardNominee;
  nominees: IAwardNominee[];
}

export interface IAward extends Document {
  awardName: string;      // e.g. "Crunchyroll Anime Awards"
  edition: string;        // e.g. "10th Annual Anime Awards"
  year: number;           // e.g. 2026
  slug: string;           // e.g. "crunchyroll-anime-awards-2026"
  status: 'announced' | 'voting' | 'completed';
  ceremonyDate?: string;
  location?: string;
  bannerImage?: string;
  categories: IAwardCategory[];
  totalCategories: number;
  createdAt: Date;
  updatedAt: Date;
}

const AwardNomineeSchema = new Schema<IAwardNominee>(
  {
    title: {
      english: { type: String, required: true },
      romaji: { type: String, default: '' },
      native: { type: String, default: '' },
    },
    franchiseSlug: { type: String, default: '' },
    anilistId: { type: Number, default: null },
    malId: { type: Number, default: null },
    imageUrl: { type: String, default: '' },
    nomineeName: { type: String, default: '' },
    details: { type: String, default: '' },
    isWinner: { type: Boolean, default: false },
  },
  { _id: false }
);

const AwardCategorySchema = new Schema<IAwardCategory>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true },
    description: { type: String, default: '' },
    winner: { type: AwardNomineeSchema, default: null },
    nominees: [AwardNomineeSchema],
  },
  { _id: false }
);

const AwardSchema = new Schema<IAward>(
  {
    awardName: { type: String, required: true, trim: true, default: 'Crunchyroll Anime Awards' },
    edition: { type: String, required: true, trim: true },
    year: { type: Number, required: true, index: true },
    slug: { type: String, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: ['announced', 'voting', 'completed'],
      default: 'completed',
      index: true,
    },
    ceremonyDate: { type: String, default: '' },
    location: { type: String, default: 'Tokyo, Japan' },
    bannerImage: { type: String, default: '' },
    categories: [AwardCategorySchema],
    totalCategories: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

// Compound Index for fast lookups
AwardSchema.index({ year: -1, awardName: 1 });

export const Award = mongoose.model<IAward>('Award', AwardSchema);

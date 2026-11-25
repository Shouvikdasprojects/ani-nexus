import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IMangaCreator {
  id?: number;
  name: string;
  role: string; // 'Story' | 'Art' | 'Story & Art' | 'Original Creator'
}

export interface IMangaGenre {
  name: string;
  slug: string;
  icon?: string;
}

export interface IMangaAdaptation {
  relationType: string; // 'ADAPTATION' | 'SOURCE' | 'SIDE_STORY' | 'SPIN_OFF' | 'SEQUEL' | 'PREQUEL'
  type: 'ANIME' | 'MANGA';
  title: string;
  id?: number;
  idMal?: number;
  slug?: string;
  format?: string;
  status?: string;
  coverImage?: string;
}

export interface IMangaCharacterRef {
  characterId?: number;
  name: string;
  role: string;
  image?: string;
}

export interface IManga extends Document {
  slug: string;
  ids: {
    malId?: number;
    aniId?: number;
  };
  type: 'MANGA' | 'MANHWA' | 'MANHUA' | 'LIGHT_NOVEL' | 'WEB_NOVEL' | 'ONE_SHOT' | 'DOUJINSHI';
  countryOfOrigin: string; // 'JP', 'KR', 'CN', 'TW', 'OTHER'
  format: string; // 'MANGA', 'NOVEL', 'ONE_SHOT'
  readingDirection: 'right-to-left' | 'top-to-bottom' | 'left-to-right';
  titles: {
    primary: string;
    english?: string;
    romaji?: string;
    native?: string;
    synonyms: string[];
  };
  status: 'RELEASING' | 'FINISHED' | 'NOT_YET_RELEASED' | 'CANCELLED' | 'HIATUS';
  chapters?: number;
  volumes?: number;
  releaseYear?: number;
  endYear?: number;
  startDate?: {
    year?: number;
    month?: number;
    day?: number;
  };
  endDate?: {
    year?: number;
    month?: number;
    day?: number;
  };
  synopsis?: string;
  images: {
    cover: string;
    banner?: string;
  };
  genres: IMangaGenre[];
  tags: Array<{ name: string; rank?: number }>;
  demographic?: string;
  creators: IMangaCreator[];
  publishers: string[];
  serializationMagazine?: string;
  scores: {
    weightedAverage: number;
    dualCommunity: {
      primary?: number;
      secondary?: number;
    };
    popularity: number;
    favorites: number;
    rank?: number;
  };
  adaptations: IMangaAdaptation[];
  characters: IMangaCharacterRef[];
  licensing: {
    officialReadingUrl?: string;
    publishers: string[];
  };
  isAdult: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const MangaSchema = new Schema<IManga>(
  {
    slug: { type: String, required: true, unique: true, index: true },
    ids: {
      malId: { type: Number, index: true },
      aniId: { type: Number, index: true },
    },
    type: {
      type: String,
      enum: ['MANGA', 'MANHWA', 'MANHUA', 'LIGHT_NOVEL', 'WEB_NOVEL', 'ONE_SHOT', 'DOUJINSHI'],
      default: 'MANGA',
      index: true,
    },
    countryOfOrigin: { type: String, default: 'JP', index: true },
    format: { type: String, default: 'MANGA', index: true },
    readingDirection: {
      type: String,
      enum: ['right-to-left', 'top-to-bottom', 'left-to-right'],
      default: 'right-to-left',
    },
    titles: {
      primary: { type: String, required: true },
      english: { type: String },
      romaji: { type: String },
      native: { type: String },
      synonyms: [{ type: String }],
    },
    status: {
      type: String,
      enum: ['RELEASING', 'FINISHED', 'NOT_YET_RELEASED', 'CANCELLED', 'HIATUS'],
      default: 'FINISHED',
      index: true,
    },
    chapters: { type: Number, default: 0 },
    volumes: { type: Number, default: 0 },
    releaseYear: { type: Number, index: true },
    endYear: { type: Number },
    startDate: {
      year: Number,
      month: Number,
      day: Number,
    },
    endDate: {
      year: Number,
      month: Number,
      day: Number,
    },
    synopsis: { type: String },
    images: {
      cover: { type: String, required: true },
      banner: { type: String },
    },
    genres: [
      {
        name: { type: String, required: true },
        slug: { type: String, required: true },
        icon: { type: String },
      },
    ],
    tags: [
      {
        name: { type: String },
        rank: { type: Number },
      },
    ],
    demographic: { type: String },
    creators: [
      {
        id: { type: Number },
        name: { type: String, required: true },
        role: { type: String, default: 'Story & Art' },
      },
    ],
    publishers: [{ type: String }],
    serializationMagazine: { type: String },
    scores: {
      weightedAverage: { type: Number, default: 0, index: true },
      dualCommunity: {
        primary: { type: Number },
        secondary: { type: Number },
      },
      popularity: { type: Number, default: 0, index: true },
      favorites: { type: Number, default: 0 },
      rank: { type: Number },
    },
    adaptations: [
      {
        relationType: { type: String, default: 'ADAPTATION' },
        type: { type: String, enum: ['ANIME', 'MANGA'], default: 'ANIME' },
        title: { type: String, required: true },
        id: { type: Number },
        idMal: { type: Number },
        slug: { type: String },
        format: { type: String },
        status: { type: String },
        coverImage: { type: String },
      },
    ],
    characters: [
      {
        characterId: { type: Number },
        name: { type: String },
        role: { type: String },
        image: { type: String },
      },
    ],
    licensing: {
      officialReadingUrl: { type: String },
      publishers: [{ type: String }],
    },
    isAdult: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
  }
);

MangaSchema.index({ type: 1, 'scores.weightedAverage': -1 });
MangaSchema.index({ type: 1, 'scores.popularity': -1 });
MangaSchema.index({ countryOfOrigin: 1, status: 1 });

export const Manga: Model<IManga> = mongoose.model<IManga>('Manga', MangaSchema);

import mongoose, { Schema, Document } from 'mongoose';

export interface IEpisode {
  season: number;
  episodeNumber: number;
  title: {
    english: string;
    romaji: string;
  };
  airDate?: string | null;
  durationMinutes?: number | null;
  isFiller: boolean;
  thumbnail?: string | null;
  synopsis?: string | null;
}

export interface IVoiceActor {
  actorId: number;
  language: string;
  name: {
    full: string;
    native?: string | null;
  };
  image?: string | null;
  homeTown?: string | null;
  birthday?: string | null;
  bio?: string | null;
  famousOtherRoles?: Array<{ character: string; anime: string }>;
}

export interface ICharacter {
  characterId: number;
  name: {
    full: string;
    native?: string | null;
    aliases: string[];
  };
  role: 'Main' | 'Supporting' | 'Background';
  image?: string | null;
  details?: {
    gender?: string | null;
    age?: string | null;
    birthday?: string | null;
    bloodType?: string | null;
    about?: string | null;
  };
  voiceActors: IVoiceActor[];
}

export interface ITimelinePart {
  order: number;
  partId: string;
  partName: string;
  ids: {
    malId?: number | null;
    aniId?: number | null;
    tmdbId?: number | null;
  };
  format: 'TV' | 'Movie' | 'OVA' | 'ONA' | 'Special';
  year?: number | null;
  episodeCount?: number | null;
  durationMinutes?: number | null;
  status: 'RELEASING' | 'FINISHED' | 'NOT_YET_RELEASED' | 'CANCELLED';
  isCanon: boolean;
  watchPriority: 'Essential' | 'Recommended' | 'Optional';
  scores: {
    mal?: {
      score?: number | null;
      scoredBy?: number | null;
      rank?: number | null;
      popularity?: number | null;
    };
    anilist?: {
      score?: number | null;
      popularity?: number | null;
      favorites?: number | null;
    };
    combinedAverage?: number | null;
  };
  trailer?: {
    id: string;
    site: string;
    url: string;
    embedUrl: string;
    thumbnail: string;
    title?: string | null;
  } | null;
  languages: {
    audioDubs: string[];
    subtitles: string[];
  };
  licensing: {
    isOfficiallyLicensed: boolean;
    notice: string;
    platforms: Array<{
      name: string;
      url: string;
      type: string;
    }>;
  };
  songs: {
    openings: Array<{ title: string; artist: string; videoUrl?: string | null; audioUrl?: string | null }>;
    endings: Array<{ title: string; artist: string; videoUrl?: string | null; audioUrl?: string | null }>;
  };
  episodes: IEpisode[];
}

export interface IFranchise extends Document {
  slug: string;
  titles: {
    primary: string;
    english?: string | null;
    romaji: string;
    native: string;
    synonyms: string[];
  };
  images: {
    poster?: string | null;
    backdrop?: string | null;
    logo?: string | null;
  };
  overview?: string | null;
  classification: {
    genres: Array<{ name: string; slug: string; icon?: string }>;
    themes: Array<{ name: string; slug: string; icon?: string }>;
    demographic?: { name: string; slug: string; description?: string } | null;
  };
  contentRating: {
    isAdult: boolean;
    nsfw: boolean;
    rating: string;
    ageClassification: string;
  };
  totalParts: number;
  totalEpisodes: number;
  mainCharacters: ICharacter[];
  timeline: ITimelinePart[];
  lastUpdated: Date;
  revalidateAfter: Date;
}

const EpisodeSchema = new Schema<IEpisode>(
  {
    season: { type: Number, required: true },
    episodeNumber: { type: Number, required: true },
    title: {
      english: { type: String, default: '' },
      romaji: { type: String, default: '' },
    },
    airDate: { type: String, default: null },
    durationMinutes: { type: Number, default: null },
    isFiller: { type: Boolean, default: false },
    thumbnail: { type: String, default: null },
    synopsis: { type: String, default: null },
  },
  { _id: false }
);

const VoiceActorSchema = new Schema<IVoiceActor>(
  {
    actorId: { type: Number, required: true },
    language: { type: String, required: true },
    name: {
      full: { type: String, required: true },
      native: { type: String, default: null },
    },
    image: { type: String, default: null },
    homeTown: { type: String, default: null },
    birthday: { type: String, default: null },
    bio: { type: String, default: null },
    famousOtherRoles: [
      {
        character: { type: String },
        anime: { type: String },
      },
    ],
  },
  { _id: false }
);

const CharacterSchema = new Schema<ICharacter>(
  {
    characterId: { type: Number, required: true },
    name: {
      full: { type: String, required: true },
      native: { type: String, default: null },
      aliases: [{ type: String }],
    },
    role: { type: String, enum: ['Main', 'Supporting', 'Background'], default: 'Supporting' },
    image: { type: String, default: null },
    details: {
      gender: { type: String, default: null },
      age: { type: String, default: null },
      birthday: { type: String, default: null },
      bloodType: { type: String, default: null },
      about: { type: String, default: null },
    },
    voiceActors: [VoiceActorSchema],
  },
  { _id: false }
);

const TimelinePartSchema = new Schema<ITimelinePart>(
  {
    order: { type: Number, required: true },
    partId: { type: String, required: true },
    partName: { type: String, required: true },
    ids: {
      malId: { type: Number, default: null },
      aniId: { type: Number, default: null },
      tmdbId: { type: Number, default: null },
    },
    format: { type: String, enum: ['TV', 'Movie', 'OVA', 'ONA', 'Special'], default: 'TV' },
    year: { type: Number, default: null },
    episodeCount: { type: Number, default: null },
    durationMinutes: { type: Number, default: null },
    status: { type: String, default: 'FINISHED' },
    isCanon: { type: Boolean, default: true },
    watchPriority: { type: String, enum: ['Essential', 'Recommended', 'Optional'], default: 'Essential' },
    scores: {
      mal: {
        score: { type: Number, default: null },
        scoredBy: { type: Number, default: null },
        rank: { type: Number, default: null },
        popularity: { type: Number, default: null },
      },
      anilist: {
        score: { type: Number, default: null },
        popularity: { type: Number, default: null },
        favorites: { type: Number, default: null },
      },
      combinedAverage: { type: Number, default: null },
    },
    trailer: {
      id: { type: String },
      site: { type: String, default: 'youtube' },
      url: { type: String },
      embedUrl: { type: String },
      thumbnail: { type: String },
      title: { type: String, default: null },
    },
    languages: {
      audioDubs: [{ type: String }],
      subtitles: [{ type: String }],
    },
    licensing: {
      isOfficiallyLicensed: { type: Boolean, default: true },
      notice: { type: String, default: 'Official licensing metadata. Streaming rights held by authorized distributors.' },
      platforms: [
        {
          name: { type: String, required: true },
          url: { type: String, required: true },
          type: { type: String, default: 'Subscription' },
        },
      ],
    },
    songs: {
      openings: [
        {
          title: { type: String },
          artist: { type: String },
          videoUrl: { type: String, default: null },
          audioUrl: { type: String, default: null },
        },
      ],
      endings: [
        {
          title: { type: String },
          artist: { type: String },
          videoUrl: { type: String, default: null },
          audioUrl: { type: String, default: null },
        },
      ],
    },
    episodes: [EpisodeSchema],
  },
  { _id: false }
);

const FranchiseSchema = new Schema<IFranchise>(
  {
    slug: { type: String, required: true, unique: true, index: true },
    titles: {
      primary: { type: String, required: true, index: true },
      english: { type: String, default: null, index: true },
      romaji: { type: String, required: true, index: true },
      native: { type: String, required: true, index: true },
      synonyms: [{ type: String, index: true }],
    },
    images: {
      poster: { type: String, default: null },
      backdrop: { type: String, default: null },
      logo: { type: String, default: null },
    },
    overview: { type: String, default: null },
    classification: {
      genres: [
        {
          name: { type: String, required: true },
          slug: { type: String, required: true, index: true },
          icon: { type: String, default: '🏷️' },
        },
      ],
      themes: [
        {
          name: { type: String, required: true },
          slug: { type: String, required: true, index: true },
          icon: { type: String, default: '✨' },
        },
      ],
      demographic: {
        name: { type: String },
        slug: { type: String, index: true },
        description: { type: String },
      },
    },
    contentRating: {
      isAdult: { type: Boolean, default: false, index: true },
      nsfw: { type: Boolean, default: false, index: true },
      rating: { type: String, default: 'PG-13' },
      ageClassification: { type: String, default: '13+' },
    },
    totalParts: { type: Number, default: 1 },
    totalEpisodes: { type: Number, default: 0 },
    mainCharacters: [CharacterSchema],
    timeline: [TimelinePartSchema],
    lastUpdated: { type: Date, default: Date.now },
    revalidateAfter: { type: Date, default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
  },
  {
    timestamps: true,
  }
);

// Indexes for ultra-fast multi-source ID resolution
FranchiseSchema.index({ 'timeline.ids.malId': 1 });
FranchiseSchema.index({ 'timeline.ids.aniId': 1 });
FranchiseSchema.index({ 'timeline.ids.tmdbId': 1 });

// Full text fuzzy search index
FranchiseSchema.index({
  'titles.primary': 'text',
  'titles.english': 'text',
  'titles.romaji': 'text',
  'titles.native': 'text',
  'titles.synonyms': 'text',
  'mainCharacters.name.full': 'text',
});

export const Franchise = mongoose.model<IFranchise>('Franchise', FranchiseSchema);

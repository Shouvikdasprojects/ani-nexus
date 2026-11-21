import mongoose, { Schema, Document } from 'mongoose';

export interface IVoiceActorRef {
  actorId: number;
  name: {
    full: string;
    native?: string | null;
  };
  language: string;
  image?: string | null;
  homeTown?: string | null;
  birthday?: string | null;
  bio?: string | null;
}

export interface IAnimeAppearance {
  mediaId: number;
  slug?: string | null;
  title: string;
  format?: string | null;
  role: 'MAIN' | 'SUPPORTING' | 'BACKGROUND';
  year?: number | null;
  image?: string | null;
}

export interface ICharacter extends Document {
  characterId: number; // Primary unique AniList / Universal character ID
  malId?: number | null;
  slug: string;
  name: {
    full: string;
    native?: string | null;
    alternative: string[];
    alternativeSpoiler: string[];
  };
  image?: string | null;
  favourites: number;
  details: {
    gender?: string | null;
    age?: string | null;
    birthday?: string | null;
    bloodType?: string | null;
    height?: string | null;
    about?: string | null;
  };
  primaryVoiceActor?: IVoiceActorRef | null;
  voiceActors: IVoiceActorRef[];
  animeAppearances: IAnimeAppearance[];
  mediaCount: {
    anime: number;
    manga: number;
  };
  lastUpdated: Date;
}

export const CharacterSchema = new Schema<ICharacter>(
  {
    characterId: { type: Number, required: true, unique: true, index: true },
    malId: { type: Number, default: null, index: true },
    slug: { type: String, required: true, index: true },
    name: {
      full: { type: String, required: true, index: true },
      native: { type: String, default: null },
      alternative: [{ type: String }],
      alternativeSpoiler: [{ type: String }],
    },
    image: { type: String, default: null },
    favourites: { type: Number, default: 0, index: -1 },
    details: {
      gender: { type: String, default: null },
      age: { type: String, default: null },
      birthday: { type: String, default: null },
      bloodType: { type: String, default: null },
      height: { type: String, default: null },
      about: { type: String, default: null },
    },
    primaryVoiceActor: {
      actorId: { type: Number },
      name: {
        full: { type: String },
        native: { type: String, default: null },
      },
      language: { type: String, default: 'Japanese' },
      image: { type: String, default: null },
      homeTown: { type: String, default: null },
      birthday: { type: String, default: null },
      bio: { type: String, default: null },
    },
    voiceActors: [
      {
        actorId: { type: Number, required: true },
        name: {
          full: { type: String, required: true },
          native: { type: String, default: null },
        },
        language: { type: String, required: true, index: true },
        image: { type: String, default: null },
        homeTown: { type: String, default: null },
        birthday: { type: String, default: null },
        bio: { type: String, default: null },
      },
    ],
    animeAppearances: [
      {
        mediaId: { type: Number, required: true, index: true },
        slug: { type: String, default: null },
        title: { type: String, required: true },
        format: { type: String, default: 'TV' },
        role: { type: String, enum: ['MAIN', 'SUPPORTING', 'BACKGROUND'], default: 'SUPPORTING' },
        year: { type: Number, default: null },
        image: { type: String, default: null },
      },
    ],
    mediaCount: {
      anime: { type: Number, default: 0 },
      manga: { type: Number, default: 0 },
    },
    lastUpdated: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

// Search index for fast character lookups
CharacterSchema.index({ 'name.full': 'text', 'name.native': 'text', 'name.alternative': 'text' });

export const Character = mongoose.model<ICharacter>('Character', CharacterSchema);

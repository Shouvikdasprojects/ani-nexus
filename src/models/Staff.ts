import mongoose, { Schema, Document } from 'mongoose';

export interface ISocialLink {
  platform: string;
  url: string;
}

export interface IStaffRoleCredit {
  mediaId: number;
  slug?: string | null;
  animeTitle: string;
  year?: number | null;
  format?: string | null;
  role: string; // e.g. "Director", "Sound Director", "Voice Actor"
  character?: {
    characterId?: number | null;
    name?: string | null;
    image?: string | null;
    role?: string | null;
  } | null;
}

export interface IStaff extends Document {
  staffId: number; // Primary unique AniList / Universal staff ID
  malId?: number | null;
  slug: string;
  name: {
    full: string;
    native?: string | null;
    alternative: string[];
  };
  image?: string | null;
  favourites: number;
  details: {
    birth?: string | null;
    death?: string | null;
    age?: number | null;
    gender?: string | null;
    homeTown?: string | null;
    bloodType?: string | null;
    height?: string | null;
    hobbies?: string | null;
    primaryOccupations: string[];
    yearsActive: number[];
    bio?: string | null;
  };
  socials: ISocialLink[];
  roles: IStaffRoleCredit[];
  lastUpdated: Date;
}

export const StaffSchema = new Schema<IStaff>(
  {
    staffId: { type: Number, required: true, unique: true, index: true },
    malId: { type: Number, default: null, index: true },
    slug: { type: String, required: true, index: true },
    name: {
      full: { type: String, required: true, index: true },
      native: { type: String, default: null },
      alternative: [{ type: String }],
    },
    image: { type: String, default: null },
    favourites: { type: Number, default: 0, index: -1 },
    details: {
      birth: { type: String, default: null },
      death: { type: String, default: null },
      age: { type: Number, default: null },
      gender: { type: String, default: null },
      homeTown: { type: String, default: null },
      bloodType: { type: String, default: null },
      height: { type: String, default: null },
      hobbies: { type: String, default: null },
      primaryOccupations: [{ type: String }],
      yearsActive: [{ type: Number }],
      bio: { type: String, default: null },
    },
    socials: [
      {
        platform: { type: String, required: true },
        url: { type: String, required: true },
      },
    ],
    roles: [
      {
        mediaId: { type: Number, required: true, index: true },
        slug: { type: String, default: null },
        animeTitle: { type: String, required: true },
        year: { type: Number, default: null },
        format: { type: String, default: 'TV' },
        role: { type: String, required: true },
        character: {
          characterId: { type: Number, default: null },
          name: { type: String, default: null },
          image: { type: String, default: null },
          role: { type: String, default: null },
        },
      },
    ],
    lastUpdated: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

// Search index for fast staff/voice actor lookups
StaffSchema.index({ 'name.full': 'text', 'name.native': 'text', 'name.alternative': 'text' });

export const Staff = mongoose.model<IStaff>('Staff', StaffSchema);

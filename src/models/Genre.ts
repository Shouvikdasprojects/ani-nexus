import mongoose, { Schema, Document } from 'mongoose';

export interface IGenre extends Document {
  name: string;
  slug: string;
  type: 'genre' | 'theme' | 'demographic' | 'adult';
  icon: string;
  description: string;
  totalTitles: number;
}

const GenreSchema = new Schema<IGenre>(
  {
    name: { type: String, required: true, unique: true },
    slug: { type: String, required: true, unique: true, index: true },
    type: {
      type: String,
      enum: ['genre', 'theme', 'demographic', 'adult'],
      required: true,
      index: true,
    },
    icon: { type: String, default: '🏷️' },
    description: { type: String, default: '' },
    totalTitles: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

export const Genre = mongoose.model<IGenre>('Genre', GenreSchema);

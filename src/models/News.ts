import mongoose, { Schema, Document } from 'mongoose';

export interface INews extends Document {
  title: string;
  slug: string;
  snippet: string;
  content: string;
  imageUrl?: string | null;
  category: 'news' | 'article';
  sourceName: string;
  sourceUrl: string;
  tags: string[];
  publishedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const NewsSchema = new Schema<INews>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true },
    snippet: { type: String, default: '' },
    content: { type: String, default: '' },
    imageUrl: { type: String, default: null },
    category: {
      type: String,
      enum: ['news', 'article'],
      required: true,
      index: true,
    },
    sourceName: { type: String, default: 'Anime News' },
    sourceUrl: { type: String, required: true },
    tags: [{ type: String }],
    publishedAt: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

// ⏰ 60-Day Auto-Purge TTL Index: Exactly 60 days = 5,184,000 seconds
NewsSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 24 * 60 * 60 });
NewsSchema.index({ publishedAt: -1, category: 1 });

export const News = mongoose.model<INews>('News', NewsSchema);

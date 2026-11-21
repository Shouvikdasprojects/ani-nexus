import mongoose, { Schema, Document } from 'mongoose';

export interface IScheduleSnapshot extends Document {
  snapshotId: string;
  data: any;
  totalAiringThisWeek: number;
  cachedAt: Date;
}

export const ScheduleSnapshotSchema = new Schema<IScheduleSnapshot>(
  {
    snapshotId: { type: String, default: 'weekly_calendar', unique: true, index: true },
    data: { type: Schema.Types.Mixed, required: true },
    totalAiringThisWeek: { type: Number, default: 0 },
    cachedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

export const ScheduleSnapshot = mongoose.model<IScheduleSnapshot>('ScheduleSnapshot', ScheduleSnapshotSchema);

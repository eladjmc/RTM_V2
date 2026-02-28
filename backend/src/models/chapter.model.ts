import mongoose, { type Document, Schema, type Types } from 'mongoose';

export interface IChapter extends Document {
  _id: Types.ObjectId;
  book: Types.ObjectId;
  chapterNumber: number;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const chapterSchema = new Schema<IChapter>(
  {
    book: {
      type: Schema.Types.ObjectId,
      ref: 'Book',
      required: true,
      index: true,
    },
    chapterNumber: { type: Number, required: true },
    title: { type: String, trim: true, default: '' },
    content: { type: String, required: true },
  },
  { timestamps: true },
);

chapterSchema.index({ book: 1, chapterNumber: 1 }, { unique: true });

const Chapter = mongoose.model<IChapter>('Chapter', chapterSchema);
export default Chapter;

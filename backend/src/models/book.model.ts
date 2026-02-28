import mongoose, { type Document, Schema, type Types } from 'mongoose';

export interface IBook extends Document {
  _id: Types.ObjectId;
  title: string;
  author?: string;
  cover?: string;
  lastReadChapter: Types.ObjectId | null;
  lastReadChapterNumber: number;
  lastReadAt: Date | null;
  lastReadPosition: {
    paragraphIndex: number;
    wordIndex: number;
  };
  chapterCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const bookSchema = new Schema<IBook>(
  {
    title: { type: String, required: true, trim: true },
    author: { type: String, trim: true, default: '' },
    cover: { type: String, default: '' },
    lastReadChapter: {
      type: Schema.Types.ObjectId,
      ref: 'Chapter',
      default: null,
    },
    lastReadChapterNumber: { type: Number, default: 0 },
    lastReadAt: { type: Date, default: null },
    lastReadPosition: {
      paragraphIndex: { type: Number, default: 0 },
      wordIndex: { type: Number, default: 0 },
    },
    chapterCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

const Book = mongoose.model<IBook>('Book', bookSchema);
export default Book;

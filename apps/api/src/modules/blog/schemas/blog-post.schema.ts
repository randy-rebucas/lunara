import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type BlogPostDocument = HydratedDocument<BlogPost>;

@Schema({ timestamps: true, collection: 'blog_posts' })
export class BlogPost {
  @Prop({ required: true })
  title!: string;

  @Prop({ required: true, unique: true })
  slug!: string;

  @Prop({ required: true })
  excerpt!: string;

  @Prop({ required: true })
  content!: string;

  @Prop()
  coverImageUrl?: string;

  @Prop()
  authorName?: string;

  @Prop({ default: false })
  isPublished!: boolean;

  @Prop()
  publishedAt?: Date;

  createdAt!: Date;
  updatedAt!: Date;
}

export const BlogPostSchema = SchemaFactory.createForClass(BlogPost);

import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CloudinaryStorageService } from '../../common/storage/cloudinary-storage.service';
import { BlogPost, BlogPostDocument } from './schemas/blog-post.schema';
import { CreateBlogPostDto, UpdateBlogPostDto } from './dto/blog-post.dto';

const BLOG_CLOUDINARY_FOLDER = 'lunara/blog';

@Injectable()
export class BlogService {
  constructor(
    @InjectModel(BlogPost.name) private blogPostModel: Model<BlogPostDocument>,
    private readonly cloudinaryStorageService: CloudinaryStorageService,
  ) {}

  async adminList() {
    const items = await this.blogPostModel.find().sort({ createdAt: -1 });
    return { success: true, data: items };
  }

  async create(dto: CreateBlogPostDto, authorName: string, file?: Express.Multer.File) {
    const existing = await this.blogPostModel.findOne({ slug: dto.slug });
    if (existing) throw new ConflictException('A post with this slug already exists');

    let coverImageUrl: string | undefined;
    if (file) {
      const result = await this.cloudinaryStorageService.uploadBuffer(
        file.buffer,
        BLOG_CLOUDINARY_FOLDER,
        `${Date.now()}`,
        'image',
        file.mimetype,
      );
      coverImageUrl = result.secure_url;
    }

    const isPublished = dto.isPublished ?? false;
    const post = await this.blogPostModel.create({
      title: dto.title.trim(),
      slug: dto.slug.trim(),
      excerpt: dto.excerpt.trim(),
      content: dto.content,
      authorName,
      coverImageUrl,
      isPublished,
      publishedAt: isPublished ? new Date() : undefined,
    });
    return { success: true, data: post };
  }

  async update(id: string, dto: UpdateBlogPostDto) {
    const post = await this.blogPostModel.findById(id);
    if (!post) throw new NotFoundException('Post not found');

    if (dto.slug !== undefined && dto.slug !== post.slug) {
      const existing = await this.blogPostModel.findOne({ slug: dto.slug });
      if (existing) throw new ConflictException('A post with this slug already exists');
      post.slug = dto.slug.trim();
    }
    if (dto.title !== undefined) post.title = dto.title.trim();
    if (dto.excerpt !== undefined) post.excerpt = dto.excerpt.trim();
    if (dto.content !== undefined) post.content = dto.content;
    if (dto.isPublished !== undefined && dto.isPublished !== post.isPublished) {
      post.isPublished = dto.isPublished;
      post.publishedAt = dto.isPublished ? new Date() : undefined;
    }
    await post.save();
    return { success: true, data: post };
  }

  async updateCoverImage(id: string, file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Cover image is required');
    const post = await this.blogPostModel.findById(id);
    if (!post) throw new NotFoundException('Post not found');

    const previousImageUrl = post.coverImageUrl;
    const result = await this.cloudinaryStorageService.uploadBuffer(
      file.buffer,
      BLOG_CLOUDINARY_FOLDER,
      `${post._id.toString()}-${Date.now()}`,
      'image',
      file.mimetype,
    );
    post.coverImageUrl = result.secure_url;
    await post.save();
    if (previousImageUrl) {
      await this.cloudinaryStorageService.deleteFile(BLOG_CLOUDINARY_FOLDER, previousImageUrl);
    }
    return { success: true, data: post };
  }

  async remove(id: string) {
    const post = await this.blogPostModel.findById(id);
    if (!post) throw new NotFoundException('Post not found');
    await post.deleteOne();
    if (post.coverImageUrl) {
      await this.cloudinaryStorageService.deleteFile(BLOG_CLOUDINARY_FOLDER, post.coverImageUrl);
    }
    return { success: true, data: { deleted: true } };
  }

  /** Public feed — published posts only, newest first. */
  async listPublished() {
    const items = await this.blogPostModel
      .find({ isPublished: true })
      .sort({ publishedAt: -1 })
      .select('title slug excerpt coverImageUrl authorName publishedAt');
    return { success: true, data: items };
  }

  /** Public single post by slug — only if published. */
  async getPublishedBySlug(slug: string) {
    const post = await this.blogPostModel
      .findOne({ slug, isPublished: true })
      .select('title slug excerpt content coverImageUrl authorName publishedAt');
    if (!post) throw new NotFoundException('Post not found');
    return { success: true, data: post };
  }
}

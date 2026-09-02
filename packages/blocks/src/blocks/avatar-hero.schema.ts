import { z } from 'zod';

export const avatarHeroPropsSchema = z.object({
  name: z.string().min(1),
  imageUrl: z.string().optional(),
  subtitle: z.string().optional(),
  editable: z.boolean().optional(),
});

export type AvatarHeroProps = z.infer<typeof avatarHeroPropsSchema>;

export const avatarHeroDefaultProps: AvatarHeroProps = {
  name: 'Maria Santos',
  subtitle: 'Member since 2024',
  editable: true,
};

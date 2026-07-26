import { FavoritesService } from '../../favorites/favorites.service';
import { ToolSpec } from './types';

export function buildFavoriteTools(favorites: FavoritesService): ToolSpec[] {
  return [
    {
      name: 'get_my_favorites',
      description: "List the caller's own favorite branches. Always scoped server-side to the authenticated user.",
      input_schema: { type: 'object', properties: {} },
      personas: ['emma'],
      handler: async (_input: unknown, ctx) => favorites.findAll(ctx.userId),
    },
  ];
}

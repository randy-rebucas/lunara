FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
# Copy all workspace package.json files so npm ci can resolve all dependencies
COPY apps/*/package.json ./apps/
COPY packages/*/package.json ./packages/
# Copy build configuration files
COPY tsconfig.base.json turbo.json nest-cli.json* ./
RUN npm ci --include-workspace-root

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3001
CMD ["node", "dist/main.js"]

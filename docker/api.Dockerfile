FROM node:22-alpine AS base
WORKDIR /app
# bcrypt and other native addons may need compile tooling on Alpine
RUN apk add --no-cache python3 make g++

FROM base AS deps
COPY package.json package-lock.json ./
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
COPY packages/validation/package.json ./packages/validation/
COPY apps/api/package.json ./apps/api/
COPY tsconfig.base.json ./
RUN npm ci --workspace=@lunara/api --include-workspace-root

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json /app/package-lock.json ./
COPY packages/types ./packages/types
COPY packages/utils ./packages/utils
COPY packages/validation ./packages/validation
COPY apps/api ./apps/api
COPY tsconfig.base.json ./
RUN npm run build --workspace=@lunara/types \
  && npm run build --workspace=@lunara/utils \
  && npm run build --workspace=@lunara/validation \
  && npm run build --workspace=@lunara/api \
  && npm prune --omit=dev

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Keep workspace layout so node_modules/@lunara/* symlinks resolve at runtime
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/types/package.json ./packages/types/package.json
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/packages/utils/package.json ./packages/utils/package.json
COPY --from=builder /app/packages/utils/dist ./packages/utils/dist
COPY --from=builder /app/packages/validation/package.json ./packages/validation/package.json
COPY --from=builder /app/packages/validation/dist ./packages/validation/dist

RUN mkdir -p uploads/avatars uploads/task-photos uploads/rider-documents

EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]

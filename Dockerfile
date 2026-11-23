FROM node:20-slim

WORKDIR /app

# Install workspace dependencies first for better layer caching
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

RUN npm ci

# Copy application source, shared package, and static item/prompt content
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps
COPY content ./content
COPY scripts ./scripts

# Build web bundle (API serves apps/web/dist automatically in single-service mode)
RUN npm run build

ENV NODE_ENV=production
ENV PORT=8787

EXPOSE 8787

CMD ["npm", "run", "start"]

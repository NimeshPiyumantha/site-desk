# SiteDesk on a host with a real disk.
#
# The app keeps its database and uploaded pictures in one directory, so it needs somewhere that
# survives a restart and belongs to exactly one running copy. Mount a volume at /data and point
# SITEDESK_DATA_DIR at it.
#
#   docker build -t sitedesk .
#   docker run -p 3000:3000 -v sitedesk_data:/data -e SITEDESK_SECRET=<32+ random bytes> sitedesk
#
# Run ONE copy. SQLite in a file has a single writer, and two copies with separate disks disagree
# about everything – which is exactly the problem this image exists to avoid.

# ---- dependencies, including the tools better-sqlite3 needs if no prebuilt binary matches ----
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---- production dependencies only, built against this same platform ----
FROM node:22-bookworm-slim AS proddeps
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# ---- build ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- runtime ----
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    SITEDESK_DATA_DIR=/data \
    PORT=3000
COPY --from=proddeps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.mjs ./next.config.mjs
COPY --from=build /app/package.json ./package.json
# The volume mounts over this, but the directory has to exist for a run without one.
RUN mkdir -p /data && chown -R node:node /data /app
USER node
EXPOSE 3000
CMD ["./node_modules/.bin/next", "start", "-p", "3000"]

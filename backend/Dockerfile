# syntax=docker/dockerfile:1
#
# API image. The build context is the repository root (the npm workspaces share one lockfile):
#   docker build -f backend/Dockerfile -t profithq-api .
# Needs MONGODB_URI, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET and CLIENT_ORIGIN at run time
# (see backend/.env.example). MongoDB itself is not part of the image; it stays on Atlas.

ARG NODE_VERSION=24

# ---- build: install everything and compile TypeScript ------------------------------------
FROM node:${NODE_VERSION}-slim AS build
WORKDIR /app
ENV HUSKY=0
COPY package.json package-lock.json tsconfig.base.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci
COPY backend backend
RUN npm run build -w backend

# ---- production dependencies only ---------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
# Skipping scripts is safe: argon2 loads its prebuilt binary at run time, and the root
# `prepare` script (husky, a dev tool) must not run here.
RUN npm ci -w backend --omit=dev --ignore-scripts \
  && mkdir -p backend/node_modules

# ---- runtime -----------------------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps /app/node_modules node_modules
COPY --from=prod-deps /app/backend/node_modules backend/node_modules
COPY --from=build /app/backend/dist backend/dist
COPY backend/package.json backend/
USER node
WORKDIR /app/backend
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "dist/server.js"]

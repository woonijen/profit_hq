# syntax=docker/dockerfile:1
#
# Web image: the built single-page app behind nginx, which also forwards /api to the API
# container, so the browser sees one origin (the refresh-token cookie then needs no CORS setup).
# The build context is the repository root:
#   docker build -f frontend/Dockerfile -t profithq-web .

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-slim AS build
WORKDIR /app
ENV HUSKY=0
COPY package.json package-lock.json tsconfig.base.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci
COPY frontend frontend
# "/api" works with the bundled nginx. Set a full URL (https://api.example.com/api) only when
# the API is served from another origin.
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build -w frontend

FROM nginxinc/nginx-unprivileged:stable-alpine AS runtime
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 8080

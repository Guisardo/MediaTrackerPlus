FROM node:20-alpine AS build

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY server/ /app/server
COPY client/ /app/client
COPY rest-api/ /app/rest-api

RUN npm ci --prefix /app/rest-api
RUN npm ci --prefix /app/server
RUN npm ci --prefix /app/client
RUN npm run build --prefix /app/server
RUN npm run build --prefix /app/client

FROM node:20-alpine AS prod-deps
WORKDIR /server

RUN apk add --no-cache python3 make g++

COPY ["server/package.json", "server/package-lock.json*", "./"]
RUN npm ci --omit=dev

FROM node:20-alpine AS runtime

RUN apk add --no-cache su-exec

WORKDIR /storage
VOLUME /storage

WORKDIR /assets
VOLUME /assets

WORKDIR /logs
VOLUME /logs

WORKDIR /app

COPY --from=build /app/server/public ./public
COPY --from=build /app/server/build ./build
COPY --from=prod-deps /server/node_modules ./node_modules

COPY server/package.json ./
COPY docker/entrypoint.sh /docker/entrypoint.sh

RUN chmod +x /docker/entrypoint.sh

ENV PORT=7481
EXPOSE 7481

ENV PUID=1000
ENV PGID=1000

ENV DATABASE_PATH="/storage/data.db"
ENV ASSETS_PATH="/assets"
ENV LOGS_PATH="/logs"
ENV CONFIG_DIRECTORY="/storage/.mediatracker"
ENV HOME="/home/mediatracker"
ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 CMD ["node", "-e", "const http = require('node:http'); const req = http.get({ host: '127.0.0.1', port: Number(process.env.PORT || 7481), path: '/api/configuration' }, (res) => { res.resume(); process.exit(res.statusCode && res.statusCode >= 200 && res.statusCode < 400 ? 0 : 1); }); req.on('error', () => process.exit(1)); req.setTimeout(5000, () => req.destroy(new Error('timeout')));"]

# The entrypoint runs as root to chown volume mount points, then drops to
# PUID:PGID via su-exec. This is intentional — see docker/entrypoint.sh.
# nosemgrep: dockerfile.security.missing-user-entrypoint.missing-user-entrypoint
ENTRYPOINT ["/docker/entrypoint.sh"]

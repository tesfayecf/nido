# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS frontend-build

ARG VITE_API_ORIGIN=

ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}

WORKDIR /src/app

RUN corepack enable

COPY app/package.json app/pnpm-lock.yaml ./

RUN --mount=type=cache,target=/pnpm/store \
	corepack prepare pnpm@10.6.1 --activate && \
	pnpm install --frozen-lockfile

COPY app/ ./

ENV VITE_API_ORIGIN=${VITE_API_ORIGIN}

RUN --mount=type=cache,target=/pnpm/store \
	pnpm build

FROM golang:1.24.5-alpine AS backend-build

ARG TARGETARCH
ARG TARGETOS

WORKDIR /src/server

RUN apk add --no-cache ca-certificates

COPY server/go.mod server/go.sum ./

RUN --mount=type=cache,target=/go/pkg/mod \
	go mod download

COPY server/ ./

RUN --mount=type=cache,target=/go/pkg/mod \
	--mount=type=cache,target=/root/.cache/go-build \
	CGO_ENABLED=0 \
	GOOS=${TARGETOS:-linux} \
	GOARCH=${TARGETARCH} \
	go build \
		-buildvcs=false \
		-tags netgo,osusergo \
		-trimpath \
		-ldflags='-s -w' \
		-o /out/nido \
		./cmd/server

FROM nginx:1.27-alpine

RUN apk add --no-cache ca-certificates dumb-init

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/entrypoint.sh /entrypoint.sh
COPY --from=frontend-build /src/app/.dist /usr/share/nginx/html
COPY --from=backend-build /out/nido /usr/local/bin/nido

RUN mkdir -p /app/backups && chmod +x /entrypoint.sh

ENV NIDO_HTTP_ADDR=127.0.0.1:18080 \
	NIDO_DATABASE_PATH=/data/nido.db \
	NIDO_BACKUP_DIR=/app/backups \
	AUTO_MIGRATE=true \
	MIGRATION_STRATEGY=safe-auto \
	NIDO_BOOTSTRAP_ADMIN_EMAIL=admin@local \
	NIDO_BOOTSTRAP_ADMIN_NAME="Local Admin" \
	NIDO_BOOTSTRAP_ADMIN_PASSWORD=dev-password \
	NIDO_AUTH_SESSION_TTL=24h \
	TMPDIR=/tmp

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
	CMD wget -q -O /dev/null http://127.0.0.1/api/v1/health/live || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--", "/entrypoint.sh"]

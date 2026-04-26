# Docker Deployment

This setup packages the documented split runtime into a single container for a single-user, single-host deployment:

- the Go API and scheduler described in [server/docs/local-development.md](/home/tesfa/Finance/tools/home-searcher/server/docs/local-development.md)
- the built Vite frontend described in [app/docs/local-development.md](/home/tesfa/Finance/tools/home-searcher/app/docs/local-development.md)

The image keeps the frontend same-origin with the API by serving static assets through Nginx and proxying `/api/*` to the Go process on `127.0.0.1:18080` inside the same container. That stays aligned with the frontend API client contract while avoiding deployment-time CORS reliance.

## Files

- `Dockerfile`: one multi-stage image that builds both the frontend and backend
- `entrypoint.sh`: starts the backend and Nginx together and forwards termination cleanly
- `nginx.conf`: static file serving plus same-container `/api` reverse proxy with SSE-friendly settings
- `docker-compose.yml`: one-service deployment stack with persistent SQLite storage

## Build And Run

From the repository root:

```bash
docker compose -f docker/docker-compose.yml build
docker compose -f docker/docker-compose.yml up -d
```

Then open:

```text
http://127.0.0.1:3000
```

Default login matches the backend docs:

```text
email: admin@local
password: dev-password
```

## Persistence

SQLite data is stored in the named volume `home_searcher_data` at `/data/home-searcher.db` inside the app container.

To stop and remove the stack:

```bash
docker compose -f docker/docker-compose.yml down
```

To remove the database volume too:

```bash
docker compose -f docker/docker-compose.yml down -v
```
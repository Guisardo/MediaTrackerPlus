# MediaTrackerPlus

Self-hosted media tracker for movies, TV shows, video games, books, and audiobooks.

MediaTrackerPlus helps you manage a personal library, track progress, maintain a watchlist, and keep metadata synchronized across several media types from a single application.

## Highlights

- Multi-user support
- Watchlist and calendar views
- Notifications
- REST API
- Import from Trakt and Goodreads
- Docker image for self-hosted deployment

## Quick start

```bash
docker volume create assets

docker run \
  -d \
  --name mediatracker-plus \
  -p 7481:7481 \
  -v /path/to/data:/storage \
  -v assets:/assets \
  -e SERVER_LANG=en \
  -e TMDB_LANG=en \
  -e AUDIBLE_LANG=us \
  -e TZ=Europe/London \
  guisardo/mediatracker-plus:latest
```

Open `http://localhost:7481` after the container starts.

## Docker Compose

```yaml
services:
  mediatracker:
    image: guisardo/mediatracker-plus:latest
    container_name: mediatracker-plus
    ports:
      - "7481:7481"
    volumes:
      - /path/to/data:/storage
      - assetsVolume:/assets
    environment:
      SERVER_LANG: en
      TMDB_LANG: en
      AUDIBLE_LANG: us
      TZ: Europe/London

volumes:
  assetsVolume:
```

## Common environment variables

- `SERVER_LANG`: UI/server language. Supported values include `da`, `de`, `en`, `es`, `fr`, `ko`, and `pt`.
- `TMDB_LANG`: TMDB metadata language.
- `AUDIBLE_LANG`: Audible marketplace region such as `us`, `gb`, or `de`.
- `DATABASE_CLIENT`: `better-sqlite3` or `pg`.
- `DATABASE_PATH`: SQLite database path.
- `DATABASE_URL`: Postgres connection string.
- `ASSETS_PATH`: poster and backdrop storage path.
- `LOGS_PATH`: application log path.
- `HOSTNAME`: bind address.
- `PORT`: listen port.
- `TZ`: container time zone.

## Integrations

- TMDB for movies and TV metadata
- IGDB for video game metadata
- Open Library for books
- Audible for audiobooks
- Jellyfin, Plex, and Kodi integrations

## Repository

- Source: https://github.com/Guisardo/MediaTrackerPlus
- Documentation: https://github.com/Guisardo/MediaTrackerPlus#readme
- API docs: https://guisardo.github.io/MediaTrackerPlus/

# Prayer Times settings service (Cloudflare Worker)

Holds each masjid's shared settings and pushes them to that masjid's screens. Used when the display is built with `SETTINGS_SOURCE=cloudflare` — see [docs/remote-settings.md](../docs/remote-settings.md) for the full setup (Cloudflare Access sign-in, variables, publishing).

```bash
cd worker
npx wrangler login
npx wrangler deploy
```

| Route                   | Who                               | What                                                          |
| ----------------------- | --------------------------------- | ------------------------------------------------------------- |
| `GET /m/<CODE>`         | anyone                            | current settings `{ version, updatedAt, settings }`           |
| `GET /m/<CODE>/live`    | anyone                            | WebSocket: current settings on connect, then each new version |
| `GET /m/<CODE>/publish` | Cloudflare Access                 | the publish page                                              |
| `PUT /m/<CODE>/publish` | Cloudflare Access, same site only | store a new version                                           |

One Durable Object per code (SQLite storage, available on the Workers Free plan); live connections use the WebSocket Hibernation API, so idle screens cost nothing. Tests: `npx vitest run worker` from the repository root.

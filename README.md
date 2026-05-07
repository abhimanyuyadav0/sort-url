# short-url

A tiny, framework-agnostic **in-memory URL shortener** with an optional Express router.

## Install

```bash
npm i @abhimanyuyadav/short-url
```

## Usage (core)

```js
import { createShortener } from "@abhimanyuyadav/short-url";

const shortener = createShortener({ baseUrl: "https://sho.rt" });

const { shortCode, shortUrl, expiresAt } = shortener.shorten({
  url: "https://example.com",
  customAlias: "ex",
  expiresInSeconds: 3600,
});

const { originalUrl } = shortener.resolve(shortCode);
const stats = shortener.stats(shortCode);
```

## Usage (Express)

```bash
npm i express
```

```js
import express from "express";
import { createShortUrlRouter } from "@abhimanyuyadav/short-url/express";

const app = express();
app.use(express.json());

const { router } = createShortUrlRouter({ baseUrl: "http://localhost:3000" });
app.use(router);

app.listen(3000);
```

### Express endpoints

- `POST /shorten` body: `{ url, customAlias?, expiresIn? }` (where `expiresIn` is seconds)
- `GET /stats/:shortCode`
- `GET /:shortCode` (302 redirect)
- `GET /health`

## Notes / limitations

- Storage is **in-memory** (process-local). For production you’ll likely want a database-backed adapter.
- Codes are random alphanumeric (default length 6).

## License

ISC


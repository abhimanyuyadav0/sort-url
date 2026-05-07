function isValidHttpUrl(value) {
  if (typeof value !== "string" || value.trim().length === 0) return false;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function generateCode(length = 6) {
  const alphabet =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function isExpired(record, atMs = Date.now()) {
  return record.expiresAtMs != null && atMs >= record.expiresAtMs;
}

function toIsoOrNull(ms) {
  return ms == null ? null : new Date(ms).toISOString();
}

export class ShortUrlError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = "ShortUrlError";
    this.code = code;
    this.details = details ?? undefined;
  }
}

/**
 * Creates an in-memory URL shortener service.
 *
 * @param {object} [options]
 * @param {string} [options.baseUrl] Base URL used when returning `shortUrl` (e.g. "https://sho.rt")
 * @param {number} [options.codeLength] Short code length (default: 6)
 * @param {(n:number)=>string} [options.codeGenerator] Custom code generator
 */
export function createShortener(options = {}) {
  const {
    baseUrl = null,
    codeLength = 6,
    codeGenerator = (n) => generateCode(n),
  } = options;

  const byCode = new Map();
  const byUrl = new Map();

  function buildShortUrl(shortCode) {
    if (!baseUrl) return null;
    const trimmed = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    return `${trimmed}/${shortCode}`;
  }

  function getRecordOrThrow(shortCode) {
    const record = byCode.get(shortCode);
    if (!record) {
      throw new ShortUrlError("NOT_FOUND", "shortCode not found", { shortCode });
    }
    return record;
  }

  /**
   * @param {object} input
   * @param {string} input.url
   * @param {string} [input.customAlias]
   * @param {number} [input.expiresInSeconds]
   */
  function shorten({ url, customAlias, expiresInSeconds } = {}) {
    if (!isValidHttpUrl(url)) {
      throw new ShortUrlError(
        "INVALID_URL",
        'Invalid or missing "url" (must be http/https).',
        { url }
      );
    }

    const existingCode = byUrl.get(url);
    if (existingCode) {
      const existingRecord = byCode.get(existingCode);
      if (existingRecord) {
        if (
          typeof expiresInSeconds === "number" &&
          Number.isFinite(expiresInSeconds)
        ) {
          const base = Date.now();
          existingRecord.expiresAtMs =
            expiresInSeconds > 0 ? base + expiresInSeconds * 1000 : base;
        }

        return {
          shortCode: existingCode,
          shortUrl: buildShortUrl(existingCode),
          expiresAt: toIsoOrNull(existingRecord.expiresAtMs),
        };
      }
      byUrl.delete(url);
    }

    const wantedAlias =
      typeof customAlias === "string" && customAlias.trim().length > 0
        ? customAlias.trim()
        : null;

    if (wantedAlias && byCode.has(wantedAlias)) {
      throw new ShortUrlError("ALIAS_TAKEN", "customAlias already taken", {
        customAlias: wantedAlias,
      });
    }

    let shortCode = wantedAlias;
    if (!shortCode) {
      do {
        shortCode = codeGenerator(codeLength);
      } while (byCode.has(shortCode));
    }

    const createdAtMs = Date.now();
    let expiresAtMs = null;
    if (
      typeof expiresInSeconds === "number" &&
      Number.isFinite(expiresInSeconds)
    ) {
      expiresAtMs =
        expiresInSeconds > 0
          ? createdAtMs + expiresInSeconds * 1000
          : createdAtMs;
    }

    byCode.set(shortCode, {
      originalUrl: url,
      clicks: 0,
      createdAtMs,
      expiresAtMs,
    });
    byUrl.set(url, shortCode);

    return {
      shortCode,
      shortUrl: buildShortUrl(shortCode),
      expiresAt: toIsoOrNull(expiresAtMs),
    };
  }

  function resolve(shortCode) {
    const record = getRecordOrThrow(shortCode);
    if (isExpired(record)) {
      throw new ShortUrlError("EXPIRED", "short URL has expired", { shortCode });
    }
    record.clicks += 1;
    return {
      originalUrl: record.originalUrl,
    };
  }

  function stats(shortCode) {
    const record = getRecordOrThrow(shortCode);
    return {
      originalUrl: record.originalUrl,
      clicks: record.clicks,
      createdAt: new Date(record.createdAtMs).toISOString(),
      expiresAt: toIsoOrNull(record.expiresAtMs),
      isExpired: isExpired(record),
    };
  }

  function has(shortCode) {
    return byCode.has(shortCode);
  }

  return { shorten, resolve, stats, has };
}


import express from "express";
import { ShortUrlError, createShortener } from "./core.js";

function errorToHttp(err) {
  if (err instanceof ShortUrlError) {
    if (err.code === "INVALID_URL") return { status: 400, body: { error: err.message } };
    if (err.code === "ALIAS_TAKEN") return { status: 409, body: { error: err.message } };
    if (err.code === "NOT_FOUND") return { status: 404, body: { error: err.message } };
    if (err.code === "EXPIRED") return { status: 410, body: { error: err.message } };
    return { status: 400, body: { error: err.message } };
  }
  return { status: 500, body: { error: "internal error" } };
}

/**
 * Express router for a short URL service.
 *
 * Endpoints:
 * - POST /shorten { url, customAlias?, expiresIn? (seconds) }
 * - GET  /stats/:shortCode
 * - GET  /:shortCode (302 redirect)
 *
 * @param {object} [options]
 * @param {string} [options.baseUrl]
 * @param {ReturnType<typeof createShortener>} [options.service]
 */
export function createShortUrlRouter(options = {}) {
  const { baseUrl = null, service = createShortener({ baseUrl }) } = options;
  const router = express.Router();

  router.get("/health", (req, res) => {
    res.status(200).json({ message: "server is running" });
  });

  router.post("/shorten", (req, res) => {
    try {
      const { url, customAlias, expiresIn } = req.body ?? {};
      const result = service.shorten({
        url,
        customAlias,
        expiresInSeconds: expiresIn,
      });
      res.status(201).json({
        shortCode: result.shortCode,
        shortUrl: result.shortUrl ?? (baseUrl ? `${baseUrl}/${result.shortCode}` : null),
        expiresAt: result.expiresAt,
      });
    } catch (err) {
      const { status, body } = errorToHttp(err);
      res.status(status).json(body);
    }
  });

  router.get("/stats/:shortCode", (req, res) => {
    try {
      const { shortCode } = req.params;
      res.json(service.stats(shortCode));
    } catch (err) {
      const { status, body } = errorToHttp(err);
      res.status(status).json(body);
    }
  });

  router.get("/:shortCode", (req, res) => {
    try {
      const { shortCode } = req.params;
      const { originalUrl } = service.resolve(shortCode);
      res.redirect(302, originalUrl);
    } catch (err) {
      const { status, body } = errorToHttp(err);
      res.status(status).json(body);
    }
  });

  return { router, service };
}


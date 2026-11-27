/**
 * Express / Node adapter for the handler.
 * @packageDocumentation
 * @module @patina/server/express
 */
import type { IncomingMessage, ServerResponse } from "node:http";

type FetchHandler = (request: Request) => Promise<Response>;
type ExpressLikeRequest = IncomingMessage & {
  originalUrl?: string;
  body?: unknown;
  protocol?: string;
};

/**
 * Adapts a Fetch-style handler to Express (or plain Node `http`) middleware.
 *
 *   app.use("/api/patina", toExpress(patina));
 *
 * Works with or without `express.json()` in front of it.
 */
export function toExpress(handler: FetchHandler) {
  return async (req: ExpressLikeRequest, res: ServerResponse, next?: (err?: unknown) => void) => {
    try {
      const host = req.headers.host ?? "localhost";
      const url = new URL(req.originalUrl ?? req.url ?? "/", `${req.protocol ?? "http"}://${host}`);
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) {
        if (Array.isArray(v)) for (const item of v) headers.append(k, item);
        else if (v !== undefined) headers.set(k, v);
      }
      let body: string | undefined;
      if (req.method !== "GET" && req.method !== "HEAD") {
        if (req.body !== undefined && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
          body = JSON.stringify(req.body);
        } else if (typeof req.body === "string" || Buffer.isBuffer(req.body)) {
          body = req.body.toString();
        } else {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          body = Buffer.concat(chunks).toString("utf8");
        }
      }
      const response = await handler(new Request(url, { method: req.method, headers, body }));
      res.statusCode = response.status;
      for (const [key, value] of response.headers) res.setHeader(key, value);
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (e) {
      if (next) next(e);
      else {
        res.statusCode = 500;
        res.end();
      }
    }
  };
}

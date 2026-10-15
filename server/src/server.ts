import express from "express";
import { createServer } from "node:http";
import { resolve, join } from "node:path";
import { Server } from "socket.io";
import Game from "./game";
import { getQuestionPools, dataDirectory } from "./questions";

export async function createApp() {
  const app = express();
  app.disable("x-powered-by");
  const server = createServer(app);
  const origins = (process.env.PUBLIC_ORIGIN || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  const allowedOrigin = (
    origin: string | undefined,
    host: string | undefined,
  ) => {
    if (!origin) return true;
    try {
      return origins.includes(origin) || new URL(origin).host === host;
    } catch {
      return false;
    }
  };
  const io = new Server(server, {
    maxHttpBufferSize: 32768,
    connectionStateRecovery: {
      maxDisconnectionDuration: 120000,
      skipMiddlewares: false,
    },
    allowRequest: (req, callback) =>
      callback(null, allowedOrigin(req.headers.origin, req.headers.host)),
    cors: {
      origin: (origin, callback) =>
        callback(null, !origin || origins.includes(origin)),
    },
  });
  const game = new Game(await getQuestionPools());
  io.on("connection", (socket) => {
    game.addConnection(socket);
    let windowStart = Date.now(),
      count = 0;
    socket.on("message", async (message, ack) => {
      if (typeof ack !== "function") return;
      if (Date.now() - windowStart > 1000) {
        windowStart = Date.now();
        count = 0;
      }
      if (++count > 30) {
        ack({ type: "error", message: "Please slow down." });
        return;
      }
      ack(await game.onMessage(socket, message));
    });
    socket.on("disconnect", () => game.removeConnection(socket));
  });
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()",
    );
    const ancestors = process.env.REFRACT_FRAME_ANCESTORS || "'self'";
    res.setHeader(
      "Content-Security-Policy",
      `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; media-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors ${ancestors}`,
    );
    next();
  });
  app.get("/health", (_req, res) => res.json("ok"));
  const client = resolve(dataDirectory, "../../client/dist");
  app.use(express.static(client));
  app.get("/", (_req, res) => res.sendFile(join(client, "index.html")));
  return { app, server, io, game };
}

if (require.main === module)
  void createApp()
    .then(({ server, io, game }) => {
      const port = Number(process.env.PORT || process.env.SERVER_PORT || 3010);
      server.listen(port, "0.0.0.0", () =>
        console.log(`Feuding Friends listening on ${port}`),
      );
      const shutdown = () => {
        game.dispose();
        io.close();
        server.close(() => process.exit(0));
      };
      process.once("SIGTERM", shutdown);
      process.once("SIGINT", shutdown);
    })
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    });

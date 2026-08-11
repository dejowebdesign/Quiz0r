import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server } from "socket.io";
import { GameManager } from "./src/server/game-manager";
import { autoStartTunnel } from "./src/lib/tunnel";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  // Socket.io CORS: never allow origin "*". Reflect the request origin when
  // credentials are enabled so the admin session cookie is sent. The allowed
  // origin can be pinned via the SOCKET_IO_ORIGIN env var for stricter setups.
  const configuredOrigin = process.env.SOCKET_IO_ORIGIN;
  const corsOrigin: string | boolean =
    configuredOrigin && configuredOrigin.trim() !== ""
      ? configuredOrigin.trim()
      : true; // reflect request origin (same-origin deployments)

  const io = new Server(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  // Initialize game manager
  const gameManager = new GameManager(io);

  io.on("connection", (socket) => {
    gameManager.handleConnection(socket);
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Socket.io server running`);

    // Auto-start ngrok tunnel if token exists in database
    autoStartTunnel();
  });
});

import express from "express";
import { createServer } from "http";
import { Server, Socket } from "socket.io";

import Game from "./game/index";
import { getQuestionPools } from "./questions";

// Create a new express application instance
const app: express.Application = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // allow access from frontend
  },
});

// serve the frontend (for production only)
app.use(express.static("dist"));

// //health endpoint
app.get("/health", (req, res) => {
  res.json("ok");
});

async function startUp() {
  // seed the questions
  const questions = await getQuestionPools();
  // console.log("questions", questions);

  // start the game handler
  const game = new Game(questions);

  // connection events
  io.on("connection", (socket: Socket) => {
    game.addConnection(socket);

    socket.on("disconnect", () => {
      game.removeConnection(socket);
    });

    // message handler
    socket.on("message", async (message: any, callback: Function) => {
      const result = await game.onMessage(socket, message);
      callback(result);
    });
  });

  const PORT = process.env.SERVER_PORT || 3010;
  server.listen(PORT, () => {
    console.log(`listening on port *:${PORT}`);
  });
}

startUp();

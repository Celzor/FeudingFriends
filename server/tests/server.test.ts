import { test } from "node:test";
import assert from "node:assert/strict";
import { io as connect } from "socket.io-client";
import { createApp } from "../src/server";

test("HTTP security headers and socket transport refuse foreign origins, malformed actions and forged host controls", async (t) => {
  const { server, io, game } = await createApp();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}`;
  t.after(async () => {
    game.dispose();
    await new Promise<void>((resolve) => io.close(() => resolve()));
  });
  const health = await fetch(`${url}/health`);
  assert.equal(await health.json(), "ok");
  assert.equal(health.headers.get("x-content-type-options"), "nosniff");
  assert.match(
    health.headers.get("content-security-policy") || "",
    /frame-ancestors/,
  );
  const foreign = connect(url, {
    transports: ["websocket"],
    extraHeaders: { Origin: "https://foreign.invalid" },
    reconnection: false,
    timeout: 2000,
  });
  t.after(() => foreign.disconnect());
  await new Promise<void>((resolve, reject) => {
    foreign.once("connect_error", () => resolve());
    foreign.once("connect", () => reject(new Error("Foreign origin accepted")));
  });
  const host = connect(url, { transports: ["websocket"], reconnection: false }),
    player = connect(url, { transports: ["websocket"], reconnection: false });
  t.after(() => {
    host.disconnect();
    player.disconnect();
  });
  await Promise.all(
    [host, player].map(
      (s) =>
        new Promise<void>((resolve, reject) => {
          s.once("connect", () => resolve());
          s.once("connect_error", reject);
        }),
    ),
  );
  const created = await host
    .timeout(2000)
    .emitWithAck("message", {
      type: "create_lobby",
      data: { playerName: "Host" },
    });
  const lobbyCode = created.data.lobby.lobbyCode;
  await player
    .timeout(2000)
    .emitWithAck("message", {
      type: "join_lobby",
      data: { lobbyCode, playerName: "Player" },
    });
  const forged = await player
    .timeout(2000)
    .emitWithAck("message", { type: "start_game", data: { lobbyCode } });
  assert.equal(forged.type, "error");
  assert.match(forged.message, /host/);
  const malformed = await player.timeout(2000).emitWithAck("message", null);
  assert.equal(malformed.type, "error");
  const original = await host
    .timeout(2000)
    .emitWithAck("message", { type: "sync_lobby", data: { lobbyCode } });
  assert.equal(original.data.lobby.gameState, "lobby");
});

import { test, expect, type FrameLocator, type Page } from "@playwright/test";

type GameScreen = Page | FrameLocator;

async function expectDelayedPauseReplyIgnored(host: GameScreen, players: GameScreen[]) {
  await host.locator("#roundTimer").fill("30");
  await expect(players[0].locator("#roundTimer")).toHaveValue("30");
  await host.locator("#lightningRound").uncheck();
  await expect(players[0].locator("#lightningRound")).not.toBeChecked();
  await host.getByRole("button", { name: "BEGIN", exact: true }).click();
  await host.getByRole("button", { name: "START", exact: true }).click();
  await host.getByRole("button", { name: "Skip reading", exact: true }).click();
  await expect(host.getByTestId("countdown")).toHaveAttribute("data-timer-phase", "answer");

  // Delay the real transport's acknowledgement without delaying its broadcast.
  // Importing the existing Vite module keeps this test hook out of production.
  await host.locator("body").evaluate(async () => {
    const modulePath = "/src/socket.ts";
    const { socket } = await import(modulePath);
    const original = socket.emitWithAck.bind(socket);
    let delayed = false;
    socket.emitWithAck = async (...args: any[]) => {
      const response = await original(...args);
      if (args[1]?.type !== "pause_timer" || delayed) return response;
      delayed = true;
      return new Promise((resolve) => {
        (window as any).releaseTimerReply = () => resolve(response);
      });
    };
  });

  await host.getByRole("button", { name: "Pause timer", exact: true }).click();
  // Measure participant propagation after the referee has accepted the action;
  // time spent waiting for the host's request is transport latency.
  await expect(host.locator(".countdownLabel")).toHaveText("Paused");
  for (const screen of players) {
    await expect(screen.locator(".countdownLabel")).toHaveText("Paused", { timeout: 1000 });
    await expect(screen.getByTestId("countdown")).toHaveAttribute("aria-label", /paused/);
  }
  await expect.poll(() => host.locator("body").evaluate(() =>
    typeof (window as any).releaseTimerReply,
  )).toBe("function");

  await host.getByRole("button", { name: "Resume timer", exact: true }).click();
  await expect(host.locator(".countdownLabel")).toHaveText("Make it count!");
  for (const screen of players)
    await expect(screen.locator(".countdownLabel")).toHaveText("Make it count!", { timeout: 1000 });

  await host.locator("body").evaluate(async () => {
    (window as any).releaseTimerReply();
    // Give the old promise and its React update a full paint to settle.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  for (const screen of [host, ...players]) {
    await expect(screen.locator(".countdownLabel")).toHaveText("Make it count!", { timeout: 1000 });
    await expect(screen.getByTestId("countdown")).not.toHaveAttribute("aria-label", /paused/);
  }
  await expect(host.getByRole("button", { name: "Pause timer", exact: true })).toBeVisible();
  await expect(host.locator(".wrongAnswerButton")).toBeEnabled();
}

test("standalone ignores an old pause acknowledgement after a newer resume broadcast", async ({
  context,
}) => {
  const host = await context.newPage();
  const players = [await context.newPage(), await context.newPage()];
  await host.goto("./");
  await host.getByPlaceholder("Enter your player name").fill("Timer sync host");
  await host.getByRole("button", { name: "Host Lobby" }).click();
  const code = (await host.getByRole("heading", { name: /Game ID:/ }).innerText())
    .match(/\d{6}/)![0];
  for (const [index, player] of players.entries()) {
    await player.goto("./");
    await player.getByPlaceholder("Enter your player name").fill(`Timer player ${index}`);
    await player.getByPlaceholder("Enter Lobby Code").fill(code);
    await player.getByRole("button", { name: "Join Lobby" }).click();
    await expect(player.locator("#roundTimer")).toBeVisible();
  }
  await expectDelayedPauseReplyIgnored(host, players);
});

test("Refract ignores an old pause acknowledgement after a newer resume broadcast", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Feuding Friends", exact: true })).toBeVisible();
  await page.evaluate(() => {
    const people = [
      { id: 1, name: "Host", avatarUrl: null },
      { id: 2, name: "Alice", avatarUrl: null },
      { id: 3, name: "Bob", avatarUrl: null },
    ];
    const clients = people.map((person) => {
      const frame = document.createElement("iframe");
      frame.name = `participant-${person.id}`;
      frame.src = new URL("./", location.href).href;
      Object.assign(frame.style, {
        position: "absolute", inset: "0", width: "100%", height: "100%", border: "0",
        visibility: person.id === 1 ? "visible" : "hidden",
      });
      return { person, frame };
    });
    document.body.replaceChildren(...clients.map((client) => client.frame));
    const post = (client: (typeof clients)[number], data: Record<string, unknown>) =>
      client.frame.contentWindow!.postMessage({ protocol: "refract-activity/1", ...data }, location.origin);
    window.addEventListener("message", (event) => {
      const client = clients.find((candidate) => candidate.frame.contentWindow === event.source);
      if (!client || event.origin !== location.origin || event.data?.protocol !== "refract-activity/1") return;
      if (event.data.type === "ready") post(client, {
        type: "init", sessionId: "timer-sync-test", channelId: 1,
        self: client.person, participants: people, theme: "dark",
      });
      if (event.data.type === "broadcast")
        for (const other of clients)
          if (other !== client && (!event.data.to || event.data.to.includes(other.person.id)))
            post(other, { type: "message", from: client.person.id, data: event.data.data });
    });
  });
  const host = page.frameLocator('iframe[name="participant-1"]');
  const players = [
    page.frameLocator('iframe[name="participant-2"]'),
    page.frameLocator('iframe[name="participant-3"]'),
  ];
  await expect(host.getByText("You are the host", { exact: true })).toBeVisible();
  await expectDelayedPauseReplyIgnored(host, players);
});

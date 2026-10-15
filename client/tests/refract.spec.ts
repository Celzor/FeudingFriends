import { test, expect } from "@playwright/test";

test("Refract parent relay synchronizes host and players without a backend socket", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.evaluate(() => {
    const people = [
      { id: 1, name: "Host", avatarUrl: null },
      { id: 2, name: "Alice", avatarUrl: null },
      { id: 3, name: "Bob", avatarUrl: null },
    ];
    const clients = people.map((person) => {
      const frame = document.createElement("iframe");
      frame.name = `participant-${person.id}`;
      frame.src = "/";
      frame.style.width = "500px";
      frame.style.height = "850px";
      return { person, frame };
    });
    document.body.replaceChildren(...clients.map((c) => c.frame));
    const post = (c: (typeof clients)[number], data: any) =>
      c.frame.contentWindow!.postMessage(
        { protocol: "refract-activity/1", ...data },
        location.origin,
      );
    window.addEventListener("message", (e) => {
      const client = clients.find((c) => c.frame.contentWindow === e.source);
      if (
        !client ||
        e.origin !== location.origin ||
        e.data?.protocol !== "refract-activity/1"
      )
        return;
      if (e.data.type === "ready")
        post(client, {
          type: "init",
          sessionId: "browser-test",
          channelId: 1,
          self: client.person,
          participants: people,
          theme: "dark",
        });
      if (e.data.type === "broadcast")
        for (const other of clients)
          if (
            other !== client &&
            (!e.data.to || e.data.to.includes(other.person.id))
          )
            post(other, {
              type: "message",
              from: client.person.id,
              data: e.data.data,
            });
    });
    (window as any).relayClients = clients;
  });
  const host = page.frameLocator('iframe[name="participant-1"]'),
    one = page.frameLocator('iframe[name="participant-2"]'),
    two = page.frameLocator('iframe[name="participant-3"]');
  await expect(host.getByText("You are the host", { exact: true })).toBeVisible(
    { timeout: 15000 },
  );
  await expect(
    host.getByText("Alice · 2", { exact: true }).first(),
  ).toBeVisible();
  await expect(one.locator("#roundTimer")).toBeDisabled();
  await expect(two.locator("#roundTimer")).toBeDisabled();
  // Forged player command uses the relay's sender ID and must not acquire host authority.
  const alice = page.frames().find((f) => f.name() === "participant-2")!;
  await alice.evaluate(() =>
    parent.postMessage(
      {
        protocol: "refract-activity/1",
        type: "broadcast",
        data: {
          protocol: "feuding-friends/1",
          sessionId: "browser-test",
          hostId: 1,
          members: [1, 2, 3],
          kind: "action",
          requestId: "forged",
          message: {
            type: "start_game",
            data: {
              lobbyCode:
                document.body.textContent?.match(/Game ID:\s*(\d{6})/)?.[1],
            },
          },
        },
      },
      location.origin,
    ),
  );
  await expect(
    host.getByRole("heading", { name: "Lobby Config" }),
  ).toBeVisible();
  await host.locator("#lightningRound").uncheck();
  await host.locator("#roundTimer").fill("0");
  await expect(one.locator("#roundTimer")).toHaveValue("0");
  await host.getByRole("button", { name: "BEGIN", exact: true }).click();
  await host.getByRole("button", { name: "START", exact: true }).click();
  await expect(one.locator(".answerButton").first()).toBeVisible();
  await expect(one.locator(".answerButton .text").first()).toContainText("❓");
  await host.locator(".answerButton").first().click();
  await expect(one.locator(".answerButton .text").first()).not.toContainText(
    "❓",
  );
  await expect(two.locator(".answerButton .text").first()).not.toContainText(
    "❓",
  );
  // A player leaving keeps the current board; a host leaving elects a new host and resets to a fresh lobby.
  await page.evaluate(() => {
    const clients = (window as any).relayClients;
    const participants = clients.slice(0, 2).map((c: any) => c.person);
    for (const c of clients)
      c.frame.contentWindow.postMessage(
        { protocol: "refract-activity/1", type: "participants", participants },
        location.origin,
      );
  });
  await expect(one.locator(".answerButton .text").first()).not.toContainText(
    "❓",
  );
  await page.evaluate(() => {
    const clients = (window as any).relayClients;
    const participants = [clients[1].person];
    for (const c of clients)
      c.frame.contentWindow.postMessage(
        { protocol: "refract-activity/1", type: "participants", participants },
        location.origin,
      );
  });
  await expect(
    one.getByText("You are the host", { exact: true }),
  ).toBeVisible();
  await expect(
    one.getByRole("heading", { name: "Lobby Config" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

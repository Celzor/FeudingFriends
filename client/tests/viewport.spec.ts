import {
  test,
  expect,
  type FrameLocator,
  type Locator,
  type Page,
} from "@playwright/test";

test.describe.configure({ timeout: 90000 });

const desktop = { width: 1260, height: 638 };
const short = { width: 960, height: 540 };
const mobile = { width: 390, height: 640 };

// Keep the board's text stable so a randomly chosen unusually long survey does
// not change which rows should fit without scrolling at the desktop size.
const questions = {
  8: [
    {
      question: "Name something people take to the beach.",
      answers: [
        ["Towel", 30],
        ["Sunscreen", 20],
        ["Swimsuit", 15],
        ["Water", 10],
        ["Umbrella", 8],
        ["Snacks", 7],
        ["Sunglasses", 6],
        ["Sandals", 4],
      ].map(([answerText, answerScore]) => ({ answerText, answerScore })),
    },
  ],
};

async function openActivity(page: Page, participantCount = 3) {
  await page.setViewportSize(desktop);
  await page.route("**/questions.json", (route) =>
    route.fulfill({ json: questions }),
  );
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "Feuding Friends", exact: true }),
  ).toBeVisible();
  await page.evaluate((participantCount) => {
    const people = Array.from({ length: participantCount }, (_, index) => ({
      id: index + 1,
      name: index
        ? `Player ${String(index + 1).padStart(2, "0")} with a long nickname`
        : "Host",
      avatarUrl: null,
    }));
    const clients = people.slice(0, 3).map((person) => {
      const frame = document.createElement("iframe");
      frame.name = `participant-${person.id}`;
      frame.title = `Refract activity for ${person.name}`;
      frame.src = new URL("./", location.href).href;
      Object.assign(frame.style, {
        position: "absolute",
        inset: "0",
        width: "100%",
        height: "100%",
        border: "0",
        visibility: person.id === 1 ? "visible" : "hidden",
      });
      return { person, frame };
    });
    Object.assign(document.body.style, {
      margin: "0",
      width: "100vw",
      height: "100dvh",
      overflow: "hidden",
    });
    document.body.replaceChildren(...clients.map((client) => client.frame));
    const post = (client: (typeof clients)[number], data: any) =>
      client.frame.contentWindow!.postMessage(
        { protocol: "refract-activity/1", ...data },
        location.origin,
      );
    window.addEventListener("message", (event) => {
      const client = clients.find(
        (candidate) => candidate.frame.contentWindow === event.source,
      );
      if (
        !client ||
        event.origin !== location.origin ||
        event.data?.protocol !== "refract-activity/1"
      )
        return;
      if (event.data.type === "ready")
        post(client, {
          type: "init",
          sessionId: "viewport-test",
          channelId: 1,
          self: client.person,
          participants: people,
          theme: "dark",
        });
      if (event.data.type === "broadcast")
        for (const other of clients)
          if (
            other !== client &&
            (!event.data.to || event.data.to.includes(other.person.id))
          )
            post(other, {
              type: "message",
              from: client.person.id,
              data: event.data.data,
            });
    });
  }, participantCount);
  const host = page.frameLocator('iframe[name="participant-1"]');
  await expect(host.getByText("You are the host", { exact: true })).toBeVisible({
    timeout: 15000,
  });
  return host;
}

async function expectWindowFits(frame: FrameLocator) {
  const bounds = await frame.locator("html").evaluate((html) => ({
    viewportWidth: innerWidth,
    viewportHeight: innerHeight,
    width: html.scrollWidth,
    height: html.scrollHeight,
    bodyWidth: document.body.scrollWidth,
    bodyHeight: document.body.scrollHeight,
    scrollX,
    scrollY,
  }));
  expect(bounds.width, "document must not scroll sideways").toBeLessThanOrEqual(
    bounds.viewportWidth + 1,
  );
  expect(bounds.bodyWidth).toBeLessThanOrEqual(bounds.viewportWidth + 1);
  expect(
    bounds.height,
    "document must fit the activity's iframe",
  ).toBeLessThanOrEqual(bounds.viewportHeight + 1);
  expect(bounds.bodyHeight).toBeLessThanOrEqual(bounds.viewportHeight + 1);
  expect(bounds.scrollX).toBe(0);
  expect(bounds.scrollY).toBe(0);
}

async function expectInsideWindow(element: Locator) {
  await expect(element).toBeVisible();
  await expect(element).toBeInViewport({ ratio: 0.99 });
  const bounds = await element.evaluate((node) => {
    const box = node.getBoundingClientRect();
    return {
      left: box.left,
      right: box.right,
      top: box.top,
      bottom: box.bottom,
      width: innerWidth,
      height: innerHeight,
    };
  });
  expect(bounds.left).toBeGreaterThanOrEqual(-1);
  expect(bounds.top).toBeGreaterThanOrEqual(-1);
  expect(bounds.right).toBeLessThanOrEqual(bounds.width + 1);
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.height + 1);
}

async function expectLiveControlsFit(host: FrameLocator) {
  await expectWindowFits(host);
  await expectInsideWindow(host.getByTestId("countdown"));
  await expectInsideWindow(host.locator(".wrongAnswerButton"));
  await expectInsideWindow(host.locator(".scoreBoard").first());
  await expectInsideWindow(host.locator(".scoreBoard").last());
}

test("Refract fits the iframe through lobby, eight-answer round and winner reveal", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const host = await openActivity(page);
  for (const viewport of [desktop, short, mobile]) {
    await page.setViewportSize(viewport);
    await expectWindowFits(host);
    await expectInsideWindow(
      host.getByRole("button", { name: "BEGIN", exact: true }),
    );
    for (const selector of [
      "#questionPools",
      "#rounds",
      "#roundTimer",
      "#lightningRound",
      "#score",
    ]) {
      const field = host.locator(selector);
      await field.scrollIntoViewIfNeeded();
      await expectInsideWindow(field);
      await expect(field).toBeEnabled();
    }
  }
  await host.locator("#questionPools").selectOption("8");
  await host.locator("#rounds").fill("1");
  await host.locator("#roundTimer").fill("120");
  await host.locator("#score").fill("500");
  await host.locator("#lightningRound").uncheck();
  await page.setViewportSize(desktop);
  await page.screenshot({ path: "output/refract-1260x638-lobby.png" });
  await host.getByRole("button", { name: "BEGIN", exact: true }).click();
  await expectInsideWindow(
    host.getByRole("button", { name: "START", exact: true }),
  );
  await host.getByRole("button", { name: "START", exact: true }).click();
  await expect(host.locator(".answerButton")).toHaveCount(8);
  await expectLiveControlsFit(host);
  for (const answer of await host.locator(".answerButton").all())
    await expectInsideWindow(answer);
  await page.screenshot({ path: "output/refract-1260x638-round.png" });

  for (const viewport of [short, mobile]) {
    await page.setViewportSize(viewport);
    await expectLiveControlsFit(host);
    const answers = host.getByTestId("answer-board");
    await expect(answers).toHaveCSS("overflow-y", "auto");
    await host.locator(".answerButton").last().scrollIntoViewIfNeeded();
    await expectInsideWindow(host.locator(".answerButton").last());
    await expectLiveControlsFit(host);
    await host.locator(".answerButton").first().scrollIntoViewIfNeeded();
    await expectInsideWindow(host.locator(".answerButton").first());
    await page.screenshot({
      path: `output/refract-${viewport.width}x${viewport.height}-round.png`,
    });
  }

  await page.setViewportSize(desktop);
  for (let index = 0; index < 5; index++)
    await host.locator(".answerButton").nth(index).click();
  const endGame = host.getByRole("button", { name: "End Game", exact: true });
  await expectInsideWindow(endGame);
  await endGame.click();
  const returnToLobby = host.getByRole("button", {
    name: "Back to lobby",
    exact: true,
  });
  for (const viewport of [desktop, short, mobile]) {
    await page.setViewportSize(viewport);
    await expectWindowFits(host);
    await expectInsideWindow(returnToLobby);
  }
  // Native audio may require an explicit gesture when run in an embedded frame.
  const silentContinue = host.getByRole("button", {
    name: "Continue without music",
  });
  const presentation = host.locator("[data-finale-started]");
  await expect
    .poll(async () =>
      (await presentation.getAttribute("data-finale-started")) === "true" ||
      (await silentContinue.isVisible()),
    )
    .toBe(true);
  if ((await presentation.getAttribute("data-finale-started")) !== "true")
    await silentContinue.click();
  await expect(host.locator(".winner-revel3")).toBeVisible({ timeout: 12000 });
  await expect(host.locator(".mainTeamContainer")).toHaveCSS("opacity", "1", {
    timeout: 4000,
  });
  for (const viewport of [desktop, short, mobile]) {
    await page.setViewportSize(viewport);
    await expectWindowFits(host);
    await expectInsideWindow(returnToLobby);
    const finalScores = host.locator(".finalScoreBoard");
    await finalScores.last().scrollIntoViewIfNeeded();
    await expectInsideWindow(finalScores.last());
    await expectInsideWindow(returnToLobby);
    await page.screenshot({
      path: `output/refract-${viewport.width}x${viewport.height}-finale.png`,
    });
  }
  await returnToLobby.click();
  await expect(host.getByRole("heading", { name: "Lobby Config" })).toBeVisible();
  await expectWindowFits(host);
  await expectInsideWindow(
    host.getByRole("button", { name: "BEGIN", exact: true }),
  );
  expect(errors).toEqual([]);
});

test("short Refract lobbies keep settings, large rosters and eight teams reachable", async ({
  page,
}) => {
  const host = await openActivity(page, 17);
  await expect(host.locator(".playyerInLobbyLi")).toHaveCount(16);
  for (let index = 0; index < 6; index++) {
    const assignment = host.locator('select[aria-label^="Team for "]').nth(index);
    await assignment.selectOption("new_team");
    await expect(host.locator(".lobbyTeam")).toHaveCount(index + 3);
  }
  for (const viewport of [short, mobile]) {
    await page.setViewportSize(viewport);
    const begin = host.getByRole("button", { name: "BEGIN", exact: true });
    await expectInsideWindow(begin);
    await expectWindowFits(host);
    const assignments = host.locator('select[aria-label^="Team for "]');
    await assignments.last().scrollIntoViewIfNeeded();
    await expectInsideWindow(assignments.last());
    await assignments.last().selectOption("8");
    await expect(assignments.last()).toHaveValue("8");
    const timer = host.locator("#roundTimer");
    await timer.scrollIntoViewIfNeeded();
    await expectInsideWindow(timer);
    await timer.fill("45");
    await expect(timer).toHaveValue("45");
    const lastTeamName = host.locator(".lobbyTeam").last().locator("strong");
    await lastTeamName.scrollIntoViewIfNeeded();
    await expectInsideWindow(lastTeamName);
    await expectInsideWindow(begin);
    await expectWindowFits(host);
  }
});

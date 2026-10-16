import {
  test,
  expect,
  type FrameLocator,
  type Page,
} from "@playwright/test";

type GameScreen = Page | FrameLocator;

const sixAnswerQuestions = {
  6: [{
    question: "Name something people take to the beach.",
    answers: [
      ["Towel", 30],
      ["Sunscreen", 25],
      ["Swimsuit", 20],
      ["Water", 10],
      ["Umbrella", 8],
      ["Snacks", 7],
    ].map(([answerText, answerScore]) => ({ answerText, answerScore })),
  }],
};

async function startTimedRound(
  host: GameScreen,
  players: GameScreen[],
  waitForReading = true,
) {
  const witness = players[0];
  await host.locator("#questionPools").selectOption("6");
  await expect(witness.locator("#questionPools")).toHaveValues(["6"]);
  await host.locator("#rounds").fill("1");
  await expect(witness.locator("#rounds")).toHaveValue("1");
  await host.locator("#roundTimer").fill("6");
  await expect(witness.locator("#roundTimer")).toHaveValue("6");
  await host.locator("#lightningRound").uncheck();
  await expect(witness.locator("#lightningRound")).not.toBeChecked();
  await host.getByRole("button", { name: "BEGIN", exact: true }).click();
  await host.getByRole("button", { name: "START", exact: true }).click();
  await expect(host.locator(".answerButton")).toHaveCount(6);
  if (waitForReading)
    await expect(host.locator(".wrongAnswerButton"))
      .toBeEnabled({ timeout: 15000 });
}

async function expectTimeoutCooldown(host: GameScreen, players: GameScreen[]) {
  const wrong = host.locator(".wrongAnswerButton");
  const strikes = (screen: GameScreen) =>
    screen.locator(".currentTeam span").filter({ hasText: /^❌$/ });
  await expect(wrong).toBeEnabled();
  await expect(strikes(host)).toHaveCount(0);

  // Observe actual DOM updates, so assertion polling does not shorten the
  // measured cooldown or require a fixed sleep in a live timed game.
  await wrong.evaluate((button) => {
    const wrong = button as HTMLButtonElement;
    const correct = document.querySelector<HTMLButtonElement>(".answerButton")!;
    const state: {
      strikeAt?: number;
      unlockedAt?: number;
      disabledAtTimeout?: boolean;
      waitingLabelAtTimeout?: boolean;
      correctEnabledAtTimeout?: boolean;
      correctSelectedAt?: number;
      disabledAfterCorrect?: boolean;
      extraStrikeDuringCooldown?: boolean;
    } = {};
    (window as Window & { timeoutCooldown?: typeof state }).timeoutCooldown = state;
    const observer = new MutationObserver(() => {
      const strikeCount = [...document.querySelectorAll(".currentTeam span")]
        .filter((span) => span.textContent?.trim() === "❌").length;
      if (strikeCount === 1 && state.strikeAt === undefined) {
        state.strikeAt = performance.now();
        state.disabledAtTimeout = wrong.disabled;
        state.waitingLabelAtTimeout = wrong.textContent?.includes("PLEASE WAIT");
        state.correctEnabledAtTimeout = !correct.disabled;
        // Reproduce a queued wrong click at the actual timeout update without
        // spending part of the short cooldown on assertion round trips.
        wrong.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      }
      if (state.strikeAt === undefined) return;
      if (strikeCount > 1 && state.unlockedAt === undefined)
        state.extraStrikeDuringCooldown = true;
      if (correct.textContent?.includes("✔") && state.correctSelectedAt === undefined) {
        state.correctSelectedAt = performance.now();
        state.disabledAfterCorrect = wrong.disabled;
      }
      if (!wrong.disabled && state.unlockedAt === undefined)
        state.unlockedAt = performance.now();
      if (state.unlockedAt !== undefined && state.correctSelectedAt !== undefined)
        observer.disconnect();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["disabled"],
    });
  });

  await expect(strikes(host)).toHaveCount(1, { timeout: 10000 });
  const correct = host.locator(".answerButton").first();
  // Use a real pointer click: decorative strike effects must allow interaction
  // with correct answers throughout the cooldown.
  await correct.click();
  await expect(correct.locator(".text")).toContainText("✔");
  for (const player of players) {
    await expect(strikes(player)).toHaveCount(1);
    await expect(player.locator(".answerButton .text").first())
      .toContainText("✔");
  }

  await expect(wrong).toBeEnabled({ timeout: 5000 });
  await expect(wrong).toContainText("WRONG ANSWER");
  const observed = await wrong.evaluate(() => {
    return (window as Window & {
      timeoutCooldown: {
        strikeAt: number;
        unlockedAt: number;
        disabledAtTimeout: boolean;
        waitingLabelAtTimeout: boolean;
        correctEnabledAtTimeout: boolean;
        correctSelectedAt: number;
        disabledAfterCorrect: boolean;
        extraStrikeDuringCooldown?: boolean;
      };
    }).timeoutCooldown;
  });
  expect(observed.disabledAtTimeout).toBe(true);
  expect(observed.waitingLabelAtTimeout).toBe(true);
  expect(observed.correctEnabledAtTimeout).toBe(true);
  expect(observed.disabledAfterCorrect).toBe(true);
  expect(observed.correctSelectedAt).toBeLessThan(observed.unlockedAt);
  expect(observed.extraStrikeDuringCooldown).not.toBe(true);
  const cooldownDuration = observed.unlockedAt - observed.strikeAt;
  expect(cooldownDuration).toBeGreaterThanOrEqual(1700);
  expect(cooldownDuration).toBeLessThan(4000);

  await wrong.click();
  for (const screen of [host, ...players])
    await expect(strikes(screen)).toHaveCount(2);
  await expect(host.locator(".answerButton").nth(1)).toBeEnabled();
}

test("standalone timeout prevents a second wrong answer while correct answers remain usable", async ({
  context,
  baseURL,
}) => {
  test.skip(new URL(baseURL!).pathname !== "/", "Standalone needs the game server.");
  const host = await context.newPage();
  const players = [await context.newPage(), await context.newPage()];
  await host.goto("./");
  await host.getByPlaceholder("Enter your player name").fill("Timeout host");
  await host.getByRole("button", { name: "Host Lobby" }).click();
  await expect(host.getByText("You are the host", { exact: true })).toBeVisible();
  const code = (
    await host.getByRole("heading", { name: /Game ID:/ }).innerText()
  ).match(/\d{6}/)![0];
  for (const [index, player] of players.entries()) {
    const name = `Timeout player ${index + 1}`;
    await player.goto("./");
    await player.getByPlaceholder("Enter your player name").fill(name);
    await player.getByPlaceholder("Enter Lobby Code").fill(code);
    await player.getByRole("button", { name: "Join Lobby" }).click();
    await expect(player.getByText(`You are ${name}`, { exact: true })).toBeVisible();
  }
  await startTimedRound(host, players);
  await expectTimeoutCooldown(host, players);
});

async function openRefract(page: Page) {
  await page.route("**/questions.json", (route) =>
    route.fulfill({ json: sixAnswerQuestions }),
  );
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "Feuding Friends", exact: true }),
  ).toBeVisible();
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
      height: "100dvh",
      overflow: "hidden",
    });
    document.body.replaceChildren(...clients.map((client) => client.frame));
    const post = (client: (typeof clients)[number], data: Record<string, unknown>) =>
      client.frame.contentWindow!.postMessage(
        { protocol: "refract-activity/1", ...data }, location.origin,
      );
    window.addEventListener("message", (event) => {
      const client = clients.find((candidate) =>
        candidate.frame.contentWindow === event.source,
      );
      if (!client || event.origin !== location.origin ||
        event.data?.protocol !== "refract-activity/1") return;
      if (event.data.type === "ready") post(client, {
        type: "init",
        sessionId: "timeout-cooldown-test",
        channelId: 1,
        self: client.person,
        participants: people,
        theme: "dark",
      });
      if (event.data.type === "broadcast") {
        for (const other of clients) {
          if (other !== client &&
            (!event.data.to || event.data.to.includes(other.person.id))) {
            post(other, {
              type: "message",
              from: client.person.id,
              data: event.data.data,
            });
          }
        }
      }
    });
  });
  const host = page.frameLocator('iframe[name="participant-1"]');
  const players = [
    page.frameLocator('iframe[name="participant-2"]'),
    page.frameLocator('iframe[name="participant-3"]'),
  ];
  await expect(host.getByText("You are the host", { exact: true }))
    .toBeVisible({ timeout: 15000 });
  return { host, players };
}

test("Refract timeout cooldown survives a correct answer and synchronizes all participants", async ({
  page,
}) => {
  const { host, players } = await openRefract(page);
  await startTimedRound(host, players);
  await expectTimeoutCooldown(host, players);
});

test("Refract pauses and resumes the reading and answer timers without restarting either", async ({
  page,
}) => {
  const { host, players } = await openRefract(page);
  await startTimedRound(host, players, false);
  const timer = host.getByTestId("countdown");
  const seconds = () => timer.locator(".countdownDigits").innerText().then(Number);
  const toggle = host.locator(".timerToggle");
  const correct = host.locator(".answerButton").first();
  const wrong = host.locator(".wrongAnswerButton");
  await expect(timer).toHaveAttribute("data-timer-phase", "reading");
  await expect(timer.locator(".countdownDigits")).toHaveText(/^(10|9)$/);
  await expect(host.locator(".countdownLabel")).toContainText(/read the question/i);
  await expect(host.locator(".answerButton:disabled")).toHaveCount(6);
  await expect(wrong).toBeDisabled();
  for (const player of players) {
    await expect(player.getByTestId("countdown"))
      .toHaveAttribute("data-timer-phase", "reading");
    await expect(player.locator(".timerToggle")).toHaveCount(0);
  }

  await expect.poll(seconds).toBeLessThanOrEqual(8);
  await toggle.click();
  await expect(toggle).toContainText(/resume/i);
  const readingPausedAt = await seconds();
  await page.waitForTimeout(550);
  expect(await seconds()).toBe(readingPausedAt);
  await expect(timer).toHaveAttribute("data-timer-phase", "reading");
  await expect(correct).toBeDisabled();
  await expect(wrong).toBeDisabled();
  for (const player of players) {
    await expect(player.getByTestId("countdown").locator(".countdownDigits"))
      .toHaveText(String(readingPausedAt));
  }
  await toggle.click();
  await expect(toggle).toContainText(/pause/i);
  expect(await seconds()).toBeLessThanOrEqual(readingPausedAt);
  expect(await seconds()).toBeGreaterThanOrEqual(readingPausedAt - 1);

  // The answer timer starts with its full configured duration only after the
  // remaining reading period, excluding the paused time, has completed.
  await expect(timer).toHaveAttribute("data-timer-phase", "answer", { timeout: 12000 });
  await expect(timer.locator(".countdownDigits")).toHaveText(/^[56]$/);
  await expect(correct).toBeEnabled();
  await expect(wrong).toBeEnabled();
  await page.setViewportSize({ width: 320, height: 640 });
  await expect.poll(seconds).toBeLessThanOrEqual(2);
  await toggle.click();
  await expect(toggle).toContainText(/resume/i);
  const answerPausedAt = await seconds();
  expect(answerPausedAt).toBeGreaterThan(0);
  expect(answerPausedAt).toBeLessThanOrEqual(2);
  await page.waitForTimeout(550);
  expect(await seconds()).toBe(answerPausedAt);
  await expect(timer).toHaveAttribute("data-timer-phase", "answer");
  await expect(correct).toBeDisabled();
  await expect(wrong).toBeDisabled();
  for (const player of players) {
    await expect(player.getByTestId("countdown").locator(".countdownDigits"))
      .toHaveText(String(answerPausedAt));
  }
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 640 });
    const layout = await host.locator(".countdownWithControls").evaluate((well) => {
      const box = (selector: string) => {
        const rect = well.querySelector(selector)!.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
        };
      };
      return {
        timer: box("[data-testid=countdown]"),
        digits: box(".countdownDigits"),
        unit: box(".countdownUnit"),
        toggle: box(".timerToggle"),
        width: innerWidth,
        height: innerHeight,
      };
    });
    for (const part of [layout.timer, layout.digits, layout.unit, layout.toggle]) {
      expect(part.left).toBeGreaterThanOrEqual(0);
      expect(part.right).toBeLessThanOrEqual(layout.width);
      expect(part.top).toBeGreaterThanOrEqual(0);
      expect(part.bottom).toBeLessThanOrEqual(layout.height);
    }
    expect(layout.digits.right).toBeLessThanOrEqual(layout.toggle.left);
    expect(layout.unit.right).toBeLessThanOrEqual(layout.toggle.left - 1);
    expect(await seconds()).toBe(answerPausedAt);
  }
  await toggle.click();
  await expect(toggle).toContainText(/pause/i);
  expect(await seconds()).toBeLessThanOrEqual(answerPausedAt);
  expect(await seconds()).toBeGreaterThanOrEqual(answerPausedAt - 1);
  await expect(correct).toBeEnabled();
  await expect(wrong).toBeEnabled();
  await expect(host.locator(".currentTeam span").filter({ hasText: /^❌$/ }))
    .toHaveCount(0);
});

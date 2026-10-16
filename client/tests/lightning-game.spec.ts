import { test, expect, type Page } from "@playwright/test";

async function gameAudioState(page: Page) {
  return page.evaluate(async () => {
    const modulePath = "/src/audio/gameAudio.ts";
    return (await import(modulePath)).getGameAudioState() as {
      context: string;
      ready: string[];
      failures: Record<string, string>;
      music: { status: string };
      lastStarted?: { name: string; time: number; offset: number };
    };
  });
}

async function expectRoundLayout(page: Page, stacked: boolean) {
  const round = page.locator(".mainGameQuestion");
  await expect(round.getByTestId("answer-board")).toHaveCSS("display", "grid");
  await expect(round.locator(".countdownDisplay")).toBeVisible();
  await expect(round.getByTestId("countdown")).toHaveCSS("opacity", "1");
  await expect(round.locator(".countdownDigits")).toHaveText(/^\d+$/);
  await expect(round.locator(".indexCircle")).toHaveText([
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
  ]);

  const layout = await round.evaluate((root) => {
    const box = (selector: string) => {
      const element = root.querySelector(selector);
      if (!element)
        throw new Error(`Missing round layout element: ${selector}`);
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
      };
    };
    return {
      timer: box("[data-testid=countdown]"),
      display: box(".countdownDisplay"),
      well: box(".countdownWell"),
      heading: box(".roundHeading"),
      label: box(".countdownLabel"),
      team: box(".currentTeamGuessing"),
      question: box(".questionTitle"),
      answers: Array.from(root.querySelectorAll(".answerButton"), (element) => {
        const rect = element.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
        };
      }),
      viewport: innerWidth,
      mainWidth: document
        .querySelector(".mainGameContainer")!
        .getBoundingClientRect().width,
      pageWidth: document.documentElement.scrollWidth,
    };
  });

  expect(
    layout.pageWidth,
    "round must not overflow the viewport",
  ).toBeLessThanOrEqual(layout.viewport);
  for (const container of [layout.display, layout.well]) {
    expect(layout.timer.left).toBeGreaterThanOrEqual(container.left - 1);
    expect(layout.timer.right).toBeLessThanOrEqual(container.right + 1);
    expect(layout.timer.top).toBeGreaterThanOrEqual(container.top - 1);
    expect(layout.timer.bottom).toBeLessThanOrEqual(container.bottom + 1);
  }
  expect(layout.heading.right).toBeLessThanOrEqual(layout.well.left + 1);
  expect(layout.heading.top).toBeLessThan(layout.well.bottom);
  expect(layout.well.top).toBeLessThan(layout.heading.bottom);
  expect(layout.timer.bottom).toBeLessThanOrEqual(layout.label.top + 1);
  expect(layout.well.bottom).toBeLessThanOrEqual(layout.question.top + 1);
  expect(layout.team.bottom).toBeLessThanOrEqual(layout.question.top + 1);

  if (stacked) {
    for (let index = 1; index < layout.answers.length; index++) {
      const previous = layout.answers[index - 1];
      const current = layout.answers[index];
      expect(current.top).toBeGreaterThanOrEqual(previous.bottom - 1);
      expect(Math.abs(previous.left - current.left)).toBeLessThanOrEqual(1);
      expect(Math.abs(previous.right - current.right)).toBeLessThanOrEqual(1);
    }
  } else {
    expect(
      layout.mainWidth,
      "desktop game uses the available width",
    ).toBeGreaterThan(layout.viewport * 0.9);
    // Reading order is left to right on each row: 1–2, 3–4, 5–6, 7–8.
    for (let index = 0; index < layout.answers.length; index += 2) {
      const left = layout.answers[index];
      const right = layout.answers[index + 1];
      expect(left.right).toBeLessThanOrEqual(right.left + 1);
      expect(Math.abs(left.top - right.top)).toBeLessThanOrEqual(1);
      if (index > 0) {
        const previousRow = layout.answers[index - 2];
        expect(left.top).toBeGreaterThanOrEqual(previousRow.bottom - 1);
        expect(Math.abs(left.left - previousRow.left)).toBeLessThanOrEqual(1);
      }
    }
  }
}

test("host and two players finish lightning reveal and a timed eight-answer PDF game", async ({
  context,
}) => {
  // The lightning question, main question and rematch each include a real
  // ten-second reading period, in addition to the nine-second finale.
  test.setTimeout(120000);
  const host = await context.newPage(),
    one = await context.newPage(),
    two = await context.newPage();
  const errors: string[] = [];
  let endingMusicRequests = 0;
  host.on("request", (request) => {
    if (new URL(request.url()).pathname.endsWith("/sounds/endingMusic.mp3"))
      endingMusicRequests++;
  });
  for (const p of [host, one, two])
    p.on("pageerror", (e) => errors.push(e.message));
  await host.goto("/");
  await host.getByPlaceholder("Enter your player name").fill("test-host");
  await host.getByRole("button", { name: "Host Lobby" }).click();
  await expect(
    host.getByText("You are the host", { exact: true }),
  ).toBeVisible();
  // Inspect the actual decoded browser audio, without replacing AudioContext.
  await expect
    .poll(async () => (await gameAudioState(host)).ready.length)
    .toBe(14);
  await expect
    .poll(async () => (await gameAudioState(host)).context)
    .toBe("running");
  expect((await gameAudioState(host)).failures).toEqual({});
  const code = (
    await host.locator("h1").filter({ hasText: "Game ID:" }).innerText()
  ).match(/\d{6}/)![0];
  await host.locator("#questionPools").selectOption("8");
  await host.locator("#rounds").fill("1");
  await host.locator("#roundTimer").fill("30");
  await host.locator("#lightningRound").check();
  for (const [p, name] of [
    [one, "player-1"],
    [two, "player-2"],
  ] as const) {
    await p.goto("/");
    await p.getByPlaceholder("Enter your player name").fill(name);
    await p.getByPlaceholder("Enter Lobby Code").fill(code);
    await p.getByRole("button", { name: "Join Lobby" }).click();
    await expect(p.getByText(`You are ${name}`, { exact: true })).toBeVisible();
  }
  await host.getByRole("button", { name: "BEGIN", exact: true }).click();
  await host.getByRole("button", { name: "START", exact: true }).click();
  await expect(host.getByTestId("countdown")).toHaveAttribute(
    "data-timer-phase",
    "reading",
  );
  const startBuzzer = host.getByRole("button", { name: "Start!", exact: true });
  await expect(startBuzzer).toBeDisabled();
  await expect(startBuzzer).toBeEnabled({ timeout: 15000 });
  await startBuzzer.click();
  await expect(
    one.getByRole("button", { name: "Buzzer", exact: true }),
  ).toBeEnabled({ timeout: 10000 });
  // Target can move between browser input and the referee receiving it; a rejected click leaves it available.
  for (
    let attempt = 0;
    attempt < 5 &&
    (await one.getByRole("button", { name: "Buzzer", exact: true }).count());
    attempt++
  ) {
    await one.getByRole("button", { name: "Buzzer", exact: true }).click();
    await one.waitForTimeout(150);
  }
  await expect(
    host.getByText("Team One buzzed in!", { exact: true }),
  ).toBeVisible();
  await expect(one.locator(".answerButton .text").first()).toContainText("❓");
  await expect(host.getByTestId("countdown")).toBeVisible();
  await expect(host.locator(".teamRoundWarning")).toHaveCount(0);
  await expect(one.locator(".teamRoundWarning")).toHaveCount(0);
  await host.locator(".answerButton").first().click();
  await expect(
    host.getByRole("button", { name: "Continue to main game" }),
  ).toBeVisible();
  const reveal = one.getByRole("region", { name: "Lightning round answers" });
  await expect(reveal).toBeVisible();
  await expect(reveal.locator(".answerButton .text").first()).not.toContainText(
    "❓",
  );
  await expect(reveal.locator(".answerButton .text").last()).not.toContainText(
    "❓",
  );
  await host.getByRole("button", { name: "Continue to main game" }).click();
  await host.getByRole("button", { name: "START", exact: true }).click();
  await expect(host.getByTestId("countdown")).toHaveAttribute(
    "data-timer-phase",
    "reading",
  );
  await expect(host.locator(".answerButton").first()).toBeDisabled();
  await expect(host.locator(".answerButton").first()).toBeEnabled({
    timeout: 15000,
  });
  await expect(host.getByTestId("countdown")).toHaveAttribute(
    "data-timer-phase",
    "answer",
  );
  await expect(one.locator(".answerButton").first()).toBeDisabled();
  await expect(two.locator(".answerButton").first()).toBeDisabled();
  await expect(host.getByTestId("countdown")).toHaveText(/30s|29s/);
  await expect(one.locator(".answerButton .text").first()).toContainText("❓");
  for (const page of [host, one]) {
    await expect(page.locator(".teamRoundWarning")).toHaveCount(2);
    await expect(page.locator(".currentTeam .teamRoundWarning")).toHaveCount(1);
    await expect(page.locator(".currentTeam .teamRoundWarning")).toContainText(
      "YOUR TURN — MAKE IT COUNT!",
    );
  }
  // Exercise the real running round at desktop, the stacking breakpoint, and mobile.
  await expectRoundLayout(host, false);
  await host.evaluate(() => window.scrollTo(0, 0));
  await host.screenshot({ path: "output/desktop-round.png", fullPage: true });
  await host.setViewportSize({ width: 760, height: 900 });
  await expectRoundLayout(host, true);
  await host.setViewportSize({ width: 390, height: 844 });
  await expectRoundLayout(host, true);
  await host.evaluate(() => window.scrollTo(0, 0));
  await host.screenshot({ path: "output/mobile-round.png", fullPage: true });
  await host.setViewportSize({ width: 1280, height: 720 });
  await expectRoundLayout(host, false);
  await expect
    .poll(async () =>
      Number(
        (await host.getByTestId("countdown").innerText()).replace("s", ""),
      ),
    )
    .toBeLessThanOrEqual(27);
  const scaleBefore = await host
    .getByTestId("countdown")
    .evaluate((e) => getComputedStyle(e).transform);
  await host
    .locator(".answerButton")
    .first()
    .evaluate((button) => {
      const observer = new MutationObserver(() => {
        if (!button.classList.contains("clicked")) return;
        (
          window as Window & { firstAnswerAnimationAt?: number }
        ).firstAnswerAnimationAt = performance.now();
        observer.disconnect();
      });
      observer.observe(button, {
        attributes: true,
        attributeFilter: ["class"],
      });
    });
  await host.locator(".answerButton").nth(0).click();
  await expect
    .poll(async () => (await gameAudioState(host)).lastStarted?.name)
    .toMatch(/^correct/);
  await expect
    .poll(() =>
      host.evaluate(
        () =>
          (window as Window & { firstAnswerAnimationAt?: number })
            .firstAnswerAnimationAt,
      ),
    )
    .toBeDefined();
  const animationStartedAt = await host.evaluate(
    () =>
      (window as Window & { firstAnswerAnimationAt?: number })
        .firstAnswerAnimationAt!,
  );
  expect(
    Math.abs(
      (await gameAudioState(host)).lastStarted!.time - animationStartedAt,
    ),
    "correct-answer sound and animation start together",
  ).toBeLessThan(100);
  await expect(host.getByTestId("countdown")).toHaveText(/30s|29s/);
  await expect(one.locator(".answerButton .text").first()).not.toContainText(
    "❓",
  );
  const scaleAfter = await host
    .getByTestId("countdown")
    .evaluate((e) => getComputedStyle(e).transform);
  expect(scaleAfter).not.toEqual(scaleBefore);
  for (let i = 1; i < 5; i++)
    await host.locator(".answerButton").nth(i).click();
  await expect(
    host.getByRole("button", { name: "End Game", exact: true }),
  ).toBeVisible();
  await host.getByRole("button", { name: "End Game", exact: true }).click();
  await expect(
    host.getByText("The winning team is....", { exact: true }),
  ).toBeVisible();
  await expect(host.locator(".finaleAudio")).toHaveAttribute(
    "data-music-status",
    "playing",
  );
  const music = (await gameAudioState(host)).lastStarted;
  expect(music?.name).toBe("endingMusic");
  expect(
    music?.offset,
    "the victory track keeps its original musical intro",
  ).toBe(0);
  expect(
    endingMusicRequests,
    "the original victory track loads once despite StrictMode",
  ).toBe(1);
  const finale = host.locator('[data-celebration="finale"]');
  const winner = host.locator(".gameFinale .winner-revel3");
  const standings = host.locator(".gameFinale .mainTeamContainer");
  const explosion = finale.locator(".celebrationExplosionParticle");
  await expect(explosion).toHaveCount(180);
  await expect(explosion.first()).toBeHidden();
  await expect(
    host.getByRole("button", { name: "Back to lobby", exact: true }),
  ).toBeVisible();
  await expect(
    one.getByRole("button", { name: "Back to lobby", exact: true }),
  ).toHaveCount(0);
  await expect(winner).toBeHidden();
  await expect(standings).toBeHidden();
  await expect(finale).toBeHidden();
  // Stop during the buildup, with time before the track's natural ending.
  // The complete winner/standings sequence must still continue afterwards.
  await host.waitForFunction(
    (startedAt) => performance.now() - startedAt >= 7000,
    music!.time,
  );
  await host
    .getByRole("button", { name: "Stop celebration music", exact: true })
    .click();
  await expect(host.locator(".finaleAudio")).toHaveAttribute(
    "data-music-status",
    "idle",
  );
  // The requested nine-second cue follows playback, including slow downloads.
  await host.waitForFunction(
    (startedAt) => performance.now() - startedAt >= 8500,
    music!.time,
  );
  await expect(winner).toBeHidden();
  await expect(standings).toBeHidden();
  await expect(finale).toBeHidden();
  await expect(explosion.first()).toBeHidden();
  await expect(winner).toBeVisible({ timeout: 2000 });
  const revealedAfter = await host.evaluate(
    (startedAt) => performance.now() - startedAt,
    music!.time,
  );
  expect(revealedAfter).toBeGreaterThanOrEqual(9000);
  expect(revealedAfter).toBeLessThan(10200);
  await expect(finale).toBeVisible();
  await expect(explosion.first()).toBeVisible();
  await expect(explosion.first()).toHaveCSS("opacity", "1");
  const launch = await explosion.first().evaluate((element) => {
    const animation = element.getAnimations()[0];
    return {
      delay: animation.effect!.getTiming().delay,
      state: animation.playState,
      elapsed: Number(animation.currentTime),
    };
  });
  expect(launch.delay).toBe(9000);
  expect(launch.state).toBe("running");
  expect(launch.elapsed).toBeGreaterThanOrEqual(9000);
  expect(await finale.locator(".celebrationFirework").count()).toBeGreaterThan(
    1,
  );
  await expect(finale).toHaveCSS("pointer-events", "none");
  await host
    .locator(".gameFinale .winner-revel3, .gameFinale .mainTeamContainer")
    .evaluateAll(async (elements) => {
      await Promise.all(
        elements.flatMap((element) =>
          element
            .getAnimations()
            .map((animation) => animation.finished.catch(() => {})),
        ),
      );
    });
  await expect(host.locator(".gameFinale .winner-revel3")).toHaveCSS(
    "opacity",
    "1",
  );
  await expect(host.locator(".gameFinale .mainTeamContainer")).toHaveCSS(
    "opacity",
    "1",
  );
  await host.evaluate(() => window.scrollTo(0, 0));
  await host.screenshot({ path: "output/finale.png", fullPage: true });
  await host.setViewportSize({ width: 390, height: 844 });
  expect(
    await host.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await host.screenshot({ path: "output/mobile-finale.png", fullPage: true });
  expect((await gameAudioState(host)).music.status).toBe("idle");
  await host.getByRole("button", { name: "Back to lobby", exact: true }).click();
  for (const page of [host, one, two]) {
    await expect(page.getByRole("heading", { name: "Lobby Config" })).toBeVisible();
    await expect(page.locator("h1").filter({ hasText: "Game ID:" })).toContainText(code);
    await expect(page.locator(".PlayersInLobby")).toContainText("player-1");
    await expect(page.locator(".PlayersInLobby")).toContainText("player-2");
    await expect(page.locator("#questionPools")).toHaveValues(["8"]);
    await expect(page.locator("#rounds")).toHaveValue("1");
    await expect(page.locator("#roundTimer")).toHaveValue("30");
    await expect(page.locator("#lightningRound")).toBeChecked();
    await expect(page.locator(".gameFinale, .celebration")).toHaveCount(0);
    expect((await gameAudioState(page)).music.status).toBe("idle");
  }
  // A rematch can change settings and starts with no revealed answers or score.
  await host.locator("#lightningRound").uncheck();
  await expect(one.locator("#lightningRound")).not.toBeChecked();
  await host.getByRole("button", { name: "BEGIN", exact: true }).click();
  await host.getByRole("button", { name: "START", exact: true }).click();
  await expect(host.getByTestId("countdown")).toHaveAttribute(
    "data-timer-phase",
    "reading",
  );
  await expect(host.locator(".answerButton").first()).toBeDisabled();
  await expect(host.locator(".answerButton").first()).toBeEnabled({
    timeout: 15000,
  });
  await expect(host.getByTestId("countdown")).toHaveText(/30s|29s/);
  for (const page of [host, one, two]) {
    await expect(page.locator(".scoreBoard")).toHaveText(["0000", "0000"]);
    await expect(page.locator(".answerButton")).toHaveCount(8);
  }
  await expect(one.locator(".answerButton .text")).toHaveText(Array(8).fill("❓ ❓ ❓"));
  expect(errors).toEqual([]);
});

test("mobile layout stays inside viewport and retains keyboard focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByPlaceholder("Enter your player name").fill("Mobile Host");
  await page.getByRole("button", { name: "Host Lobby" }).click();
  await expect(
    page.getByText("You are the host", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.locator("#roundTimer").focus();
  await expect(page.locator("#roundTimer")).toBeFocused();
  await page.screenshot({ path: "output/mobile-lobby.png", fullPage: true });
});

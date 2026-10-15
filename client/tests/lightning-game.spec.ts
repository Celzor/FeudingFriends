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
  await expect(round.locator(".answerColumn")).toHaveCount(2);
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
      heading: box("h1"),
      label: box(".countdownLabel"),
      team: box(".currentTeamGuessing"),
      question: box(".questionTitle"),
      first: box(".answerColumn:first-child"),
      second: box(".answerColumn:last-child"),
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
  expect(layout.heading.bottom).toBeLessThanOrEqual(layout.well.top + 1);
  expect(layout.timer.bottom).toBeLessThanOrEqual(layout.label.top + 1);
  expect(layout.well.bottom).toBeLessThanOrEqual(layout.team.top + 1);
  expect(layout.team.bottom).toBeLessThanOrEqual(layout.question.top + 1);

  if (stacked) {
    expect(layout.second.top).toBeGreaterThanOrEqual(layout.first.bottom - 1);
    expect(
      Math.abs(layout.first.left - layout.second.left),
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(layout.first.right - layout.second.right),
    ).toBeLessThanOrEqual(1);
  } else {
    expect(
      layout.mainWidth,
      "desktop game uses the available width",
    ).toBeGreaterThan(layout.viewport * 0.9);
    expect(layout.first.right).toBeLessThanOrEqual(layout.second.left + 1);
    expect(Math.abs(layout.first.top - layout.second.top)).toBeLessThanOrEqual(
      1,
    );
  }
}

test("host and two players finish lightning reveal and a timed eight-answer PDF game", async ({
  context,
}) => {
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
  await host.getByRole("button", { name: "Start!", exact: true }).click();
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
  expect((await gameAudioState(host)).lastStarted?.name).toBe("endingMusic");
  expect(
    endingMusicRequests,
    "the original victory track loads once despite StrictMode",
  ).toBe(1);
  const finale = host.locator('[data-celebration="finale"]');
  await expect(finale).toBeVisible();
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
  await host
    .getByRole("button", { name: "Stop celebration music", exact: true })
    .click();
  await expect(host.locator(".finaleAudio")).toHaveAttribute(
    "data-music-status",
    "idle",
  );
  expect((await gameAudioState(host)).music.status).toBe("idle");
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

import { test, expect } from "@playwright/test";

test("host and two players finish lightning reveal and a timed eight-answer PDF game", async ({
  context,
}) => {
  const host = await context.newPage(),
    one = await context.newPage(),
    two = await context.newPage();
  const errors: string[] = [];
  for (const p of [host, one, two])
    p.on("pageerror", (e) => errors.push(e.message));
  await host.goto("/");
  await host.getByPlaceholder("Enter your player name").fill("test-host");
  await host.getByRole("button", { name: "Host Lobby" }).click();
  await expect(
    host.getByText("You are the host", { exact: true }),
  ).toBeVisible();
  const code = (
    await host.locator("h1").filter({ hasText: "Game ID:" }).innerText()
  ).match(/\d{6}/)![0];
  await host.locator("#questionPools").selectOption("8");
  await host.locator("#rounds").fill("1");
  await host.locator("#roundTimer").fill("12");
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
  await expect(host.getByTestId("countdown")).toHaveText(/12s|11s/);
  await expect(one.locator(".answerButton .text").first()).toContainText("❓");
  await expect
    .poll(async () =>
      Number(
        (await host.getByTestId("countdown").innerText()).replace("s", ""),
      ),
    )
    .toBeLessThanOrEqual(9);
  const scaleBefore = await host
    .getByTestId("countdown")
    .evaluate((e) => getComputedStyle(e).transform);
  await host.locator(".answerButton").nth(0).click();
  await expect(host.getByTestId("countdown")).toHaveText(/12s|11s/);
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

import { test, expect } from "@playwright/test";

test("a direct Pages visit explains how to launch Refract without contacting a game server", async ({
  page,
}) => {
  const requests: string[] = [];
  const failures: string[] = [];
  const errors: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  page.on("response", (response) => {
    if (response.status() >= 400) failures.push(response.url());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("./");
  await expect(page).toHaveTitle("Feuding Friends");
  await expect(
    page.getByRole("heading", { name: "Play in Refract" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Host Lobby" })).toHaveCount(0);
  await page.waitForLoadState("networkidle");
  expect(requests.filter((url) => url.includes("/socket.io/"))).toEqual([]);
  expect(requests.some((url) => url.includes("/FeudingFriends/assets/"))).toBe(
    true,
  );
  expect(failures).toEqual([]);
  expect(errors).toEqual([]);
});

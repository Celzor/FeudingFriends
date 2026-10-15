import { test, expect } from "@playwright/test";

import { takeScreenshot } from "./test.utils";
import {
  createHostlobby,
  joinClientLobby,
  hostSelectAnswer,
} from "./test.steps";

test("Successful Game", async ({ context }) => {
  /// ---------------------- host creates game

  const hostPage = await context.newPage();
  await createHostlobby(hostPage);

  // set question pool / rounds
  await hostPage.locator("#questionPools").selectOption("6");
  await hostPage.locator("#rounds").fill("2");
  await hostPage.locator("#lightningRound").check();

  // click copy code on host page
  await hostPage.getByRole("button", { name: "Copy Code" }).click();

  // getvalue from page clipboard
  const gameId = await hostPage.evaluate(() => navigator.clipboard.readText());
  console.log("Game ID:", gameId);

  /// ---------------------- clients join game

  const clientOnePage = await context.newPage();
  await joinClientLobby(clientOnePage, "player-1", gameId);

  const clientTwoPage = await context.newPage();
  await joinClientLobby(clientTwoPage, "player-2", gameId);

  // both clients shoudl be in the game now
  await takeScreenshot(hostPage, "all-joined");

  /// ---------------------- host starts game

  // swap player 1 onto team two and player two onto team one
  await hostPage
    .locator("div")
    .filter({ hasText: /^player-1---Team One \(1\)Team Two \(2\)NEW TEAM$/ })
    .locator("#team")
    .selectOption("2");
  await hostPage
    .locator("div")
    .filter({ hasText: /^player-2---Team One \(1\)Team Two \(2\)NEW TEAM$/ })
    .locator("#team")
    .selectOption("1");

  await takeScreenshot(hostPage, "game-ready");

  await hostPage.getByRole("button", { name: "BEGIN" }).click();

  await takeScreenshot(hostPage, "lightning-select-question");

  await hostPage.getByRole("button", { name: "Skip it" }).click();
  await hostPage.getByRole("button", { name: "Skip it" }).click();
  await hostPage.getByRole("button", { name: "START" }).click();

  await takeScreenshot(hostPage, "lightning-question-selected");

  await hostPage.getByRole("button", { name: "Start!" }).click();

  await takeScreenshot(hostPage, "lightning-round-begun");

  /// ---------------------- player two buzzez in

  await clientOnePage.getByRole("button", { name: "Buzzer" }).click();

  await takeScreenshot(hostPage, "client-one-buzzed");
  await takeScreenshot(clientOnePage, "client-one-buzzed");

  // expect
  await hostPage.waitForSelector("text=Team Two buzzed in!");

  // they didn't get any answer
  await hostSelectAnswer(hostPage, false);

  // expect
  await hostPage.waitForSelector("text=Team One is guessing...");

  await takeScreenshot(hostPage, "client-one-answered-wrong");

  // team one got it!!
  await hostSelectAnswer(hostPage, 1);

  // host select next round

  await hostPage.getByRole("button", { name: "Skip it" }).click();

  await hostPage.getByRole("button", { name: "START" }).click();

  // team 1 guessing?

  await hostPage.getByRole("button", { name: "❌WRONG ANSWER❌" }).click();

  // 6 qquestions has 3 answers
  await hostSelectAnswer(hostPage, 0);
  await hostSelectAnswer(hostPage, 1);
  await hostSelectAnswer(hostPage, 2);

  await takeScreenshot(hostPage, "client-one-answered-good");

  // expect to contain
  await hostPage.waitForSelector("text=Team One won the round with");

  /// ---------------------- host next round

  await hostPage.getByRole("button", { name: "Next Round" }).click();

  await hostPage.getByRole("button", { name: "Skip it" }).click();

  await hostPage.getByRole("button", { name: "START" }).click();

  await hostPage.getByRole("button", { name: "❌WRONG ANSWER❌" }).click();
  await hostPage.getByRole("button", { name: "❌WRONG ANSWER❌" }).click();
  await hostPage.getByRole("button", { name: "❌WRONG ANSWER❌" }).click();

  // steals it!!
  await hostSelectAnswer(hostPage, 0);

  /// ---------------------- host chooses end game

  await hostPage.getByRole("button", { name: "End Game" }).click();

  await hostPage.waitForSelector("text=The winning team is...");
  await hostPage.waitForSelector("text=Team One");

  await takeScreenshot(hostPage, "game-over");

  // await hostPage.waitForSelector("text=Team One won the round with");

  // await page.getByRole("button", { name: "Whale" }).click();
  // await page.getByRole("button", { name: "Skip it" }).click();
  // await page.getByRole("button", { name: "Skip it" }).click();
  // await page.getByRole("button", { name: "START LIGTNING ROUNG" }).click();
  // await page.getByRole("button", { name: "Piano 14" }).click();
  // await page.getByRole("button", { name: "Flute 09" }).click();
  // await page.getByRole("button", { name: "Harp 14" }).click();
  // await page.getByRole("button", { name: "Guitar 11" }).click();
});

import { test, expect } from "@playwright/test";

import { takeScreenshot } from "./test.utils";

const REACT_URL = "http://127.0.0.1:3011";

export async function createHostlobby(hostPage: any) {
  await test.step(
    "createHostlobby",
    async () => {
      // load app
      await hostPage.goto(REACT_URL);

      // wait for the app to load
      await hostPage.waitForSelector("text=Enter your name here!");

      // check titile
      const title = await hostPage.title();
      expect(title).toBe("Fueding Friends");

      await takeScreenshot(hostPage, "startup");

      // start host game
      await hostPage.getByPlaceholder("Enter your player name").click();
      await hostPage
        .getByPlaceholder("Enter your player name")
        .fill("test-host");

      await hostPage.getByRole("button", { name: "Host Lobby" }).click();

      await takeScreenshot(hostPage, "lobby");

      // expect
      await hostPage.waitForSelector("text=You are the host");
    },
    { box: true }
  ); // Note the "box" option here.
}

export async function joinClientLobby(
  page: any,
  playerName: string,
  gameId: string
) {
  await test.step(
    "joinClientLobby",
    async () => {
      await page.goto(REACT_URL);

      // wait for the app to load
      await page.waitForSelector("text=Enter your name here!");
      await page.waitForSelector("text=Enter your name here!");

      // check enter names + join lobby
      await page.getByPlaceholder("Enter your player name").click();
      await page.getByPlaceholder("Enter your player name").fill(playerName);

      await page.getByPlaceholder("Enter Lobby Code").click();
      await page.getByPlaceholder("Enter Lobby Code").fill(gameId);

      await page.getByRole("button", { name: "Join Lobby" }).click();

      await takeScreenshot(page, `client-${playerName}-joined`);
    },
    { box: true }
  ); // Note the "box" option here.
}

export async function hostSelectAnswer(page: any, answerIndex: number | false) {
  await test.step(
    "hostSelectAnswer",
    async () => {
      // get question options fromn the page, list is insiede a div with id ".answerButtonContainer"
      const questionOptions = page
        .locator(".answerButtonContainer")
        .locator("button");

      //get the count of our quotes list
      const quoteCount = await questionOptions.count();

      if (answerIndex !== false) {
        //iterate through quotes
        for (let i = 0; i < quoteCount; i++) {
          //get the text of the quote
          let text = await questionOptions
            .nth(i)
            .locator(".text")
            .textContent();
          //log it to the console
          console.log(`Quote: ${text}`);
        }
        // select the nth option
        await questionOptions.nth(answerIndex).click();
      } else {
        // choose "no answer"
        await page.getByRole("button", { name: "❌WRONG ANSWER❌" }).click();
      }

      await takeScreenshot(page, `selected-answer-${answerIndex}`);
    },
    { box: true }
  ); // Note the "box" option here.

  // waiut 500ms
  await page.waitForTimeout(500);
}

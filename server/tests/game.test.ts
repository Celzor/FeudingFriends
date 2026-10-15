import { test } from "node:test";
import assert from "node:assert/strict";
import Game, {
  challengeTarget,
  type GameConnection,
  type QuestionPools,
} from "../../shared/Game";

const regular = {
  question: "Name a colour",
  answers: ["Red", "Green", "Blue", "Gold", "Purple", "Pink"].map(
    (answerText, i) => ({ answerText, answerScore: 30 - i * 3 }),
  ),
};
const lightning = {
  question: "Name a pet",
  answers: [
    { answerText: "Cat", answerScore: null },
    { answerText: "Dog", answerScore: null },
  ],
};
const pools: QuestionPools = {
  1: [lightning],
  2: [lightning],
  3: [regular],
  4: [regular],
  5: [regular],
  6: [regular],
  7: [regular],
};
async function setup(t: any, lightningRound = true, timerSeconds = 10) {
  const game = new Game(pools);
  t.after(() => game.dispose());
  const events: Record<string, any[]> = {
    host: [],
    one: [],
    two: [],
    stranger: [],
  };
  const sockets = Object.fromEntries(
    Object.keys(events).map((id) => [
      id,
      { id, emit: (_event: string, m: any) => events[id].push(m) },
    ]),
  ) as Record<string, GameConnection>;
  Object.values(sockets).forEach((s) => game.addConnection(s));
  const request = async (id: string, type: string, data: any = {}) =>
    game.onMessage(sockets[id], { type, data: { ...data, lobbyCode: code } });
  const created = await game.onMessage(sockets.host, {
    type: "create_lobby",
    data: { playerName: "Host" },
  });
  const code = created.data.lobby.lobbyCode;
  await request("one", "join_lobby", { playerName: "One" });
  await request("two", "join_lobby", { playerName: "Two" });
  await request("host", "update_lobby_config", {
    lobbyConfig: {
      ...created.data.lobby.config,
      questionPools: [6],
      numberOfRounds: 2,
      lightningRound,
      timerSeconds,
    },
  });
  return { game, events, request, code, sockets };
}
async function beginRound(request: any, lightning = false) {
  const q = await request("host", "get_question", {
    isLightningQuestion: lightning,
  });
  assert.equal(q.type, "question_check");
  const result = await request(
    "host",
    lightning ? "begin_lightning_round" : "advance_round",
    { question: q.data.question },
  );
  assert.equal(result.type, "lobby_update");
  return result.data.lobby;
}

test("every host action is refused to players and strangers; invalid messages do not crash the referee", async (t) => {
  const { request, game, sockets } = await setup(t);
  for (const type of [
    "update_lobby_config",
    "update_teams",
    "start_game",
    "get_question",
    "begin_lightning_round",
    "begin_lightning_buzzer",
    "choose_lightning_answer",
    "continue_lightning",
    "advance_round",
    "choose_team_answer",
    "end_round",
    "end_game",
  ]) {
    assert.equal((await request("one", type)).type, "error", type);
    assert.equal((await request("stranger", type)).type, "error", type);
  }
  assert.equal((await game.onMessage(sockets.one, null)).type, "error");
  assert.equal(
    (
      await request("host", "update_lobby_config", {
        lobbyConfig: { questionPools: [] },
      })
    ).type,
    "error",
  );
  assert.equal(
    (
      await request("stranger", "join_lobby", {
        fakeUser: true,
        playerName: "Fake",
      })
    ).type,
    "error",
  );
});

test("players get hidden boards on joins, sync, broadcasts and buzz acknowledgments; first buzz wins", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 100000 });
  const { request, events } = await setup(t);
  await request("host", "start_game");
  await beginRound(request, true);
  const started = (await request("host", "begin_lightning_buzzer")).data.lobby;
  const challenge = started.lightningChallenge;
  t.mock.timers.tick(6000);
  const step =
    challenge.mode === "reaction"
      ? 0
      : Math.floor(
          (Date.now() - challenge.startedAt) /
            (challenge.mode === "moles" ? 1100 : 900),
        );
  assert.equal(
    (
      await request("one", "lightning_buzz_in", {
        challenge: { step, target: 99 },
      })
    ).type,
    "error",
  );
  const reply = await request("one", "lightning_buzz_in", {
    challenge: { step, target: challengeTarget(challenge.seed, step) },
  });
  assert.equal(reply.type, "lobby_update");
  assert.ok(
    reply.data.lobby.lightningQuestion.answers.every(
      (a: any) => a.answerText === "" && a.answerScore === null,
    ),
  );
  assert.equal(
    (
      await request("two", "lightning_buzz_in", {
        challenge: { step, target: challengeTarget(challenge.seed, step) },
      })
    ).type,
    "error",
  );
  assert.ok(
    (
      await request("two", "sync_lobby")
    ).data.lobby.lightningQuestion.answers.every(
      (a: any) => a.answerText === "",
    ),
  );
  assert.ok(
    events.two
      .at(-1)
      .data.lobby.lightningQuestion.answers.every(
        (a: any) => a.answerText === "",
      ),
  );
  assert.equal(
    (
      await request("host", "choose_lightning_answer", {
        answerChosen: { answerText: "Invented" },
      })
    ).type,
    "error",
  );
  const reveal = await request("host", "choose_lightning_answer", {
    answerChosen: lightning.answers[0],
  });
  assert.equal(reveal.data.lobby.gameState, "lightning_reveal");
  assert.deepEqual(
    events.two
      .at(-1)
      .data.lobby.lightningQuestion.answers.map((a: any) => a.answerText),
    ["Cat", "Dog"],
  );
  assert.equal((await request("one", "continue_lightning")).type, "error");
  assert.equal(
    (await request("host", "continue_lightning")).data.lobby.gameState,
    "host_set_question",
  );
});

test("question authority, timer reset, timeout strikes, steal expiry and duplicate answer rejection", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 100000 });
  const { request } = await setup(t, false, 10);
  await request("host", "start_game");
  assert.equal(
    (await request("host", "advance_round", { question: regular })).type,
    "error",
  );
  let lobby = await beginRound(request);
  const first = lobby.timerStart;
  t.mock.timers.tick(7000);
  lobby = (
    await request("host", "choose_team_answer", {
      answerChosen: regular.answers[0],
    })
  ).data.lobby;
  assert.equal(lobby.timerStart, 107000);
  assert.notEqual(lobby.timerStart, first);
  assert.equal(
    (
      await request("host", "choose_team_answer", {
        answerChosen: regular.answers[0],
      })
    ).type,
    "error",
  );
  t.mock.timers.tick(9999);
  lobby = (await request("host", "sync_lobby")).data.lobby;
  assert.equal(lobby.teams[0].wrongGuesses, 0);
  t.mock.timers.tick(1);
  lobby = (await request("host", "sync_lobby")).data.lobby;
  assert.equal(lobby.teams[0].wrongGuesses, 1);
  t.mock.timers.tick(10000);
  t.mock.timers.tick(10000);
  lobby = (await request("host", "sync_lobby")).data.lobby;
  assert.equal(lobby.suddenDeathTeamIndex, 1);
  t.mock.timers.tick(10000);
  lobby = (await request("host", "sync_lobby")).data.lobby;
  assert.equal(lobby.gameState, "round_end");
  assert.equal(lobby.timerStart, undefined);
  assert.equal(lobby.roundResults.length, 1);
  assert.equal(lobby.roundResults[0].result, "incorrect");
});

test("all lightning modes enforce launch delay and server-selected target; all incorrect answers still reveal board", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 100000 });
  for (const modeIndex of [0, 1, 2]) {
    const { request } = await setup(t, true, 0);
    await request("host", "start_game");
    const original = Math.random;
    Math.random = () => modeIndex / 3 + 0.01;
    let lobby;
    try {
      lobby = await beginRound(request, true);
    } finally {
      Math.random = original;
    }
    assert.equal(
      lobby.lightningChallenge.mode,
      ["chase", "moles", "reaction"][modeIndex],
    );
    lobby = (await request("host", "begin_lightning_buzzer")).data.lobby;
    assert.equal(
      (
        await request("one", "lightning_buzz_in", {
          challenge: { step: 0, target: 0 },
        })
      ).type,
      "error",
    );
    t.mock.timers.tick(6000);
    const c = lobby.lightningChallenge;
    const step =
      c.mode === "reaction"
        ? 0
        : Math.floor(
            (Date.now() - c.startedAt) / (c.mode === "moles" ? 1100 : 900),
          );
    assert.equal(
      (
        await request("one", "lightning_buzz_in", {
          challenge: { step, target: challengeTarget(c.seed, step) },
        })
      ).type,
      "lobby_update",
    );
    await request("host", "choose_lightning_answer", { answerChosen: false });
    const reveal = await request("host", "choose_lightning_answer", {
      answerChosen: false,
    });
    assert.equal(reveal.data.lobby.gameState, "lightning_reveal");
  }
});

test("team updates cannot forge users or scores; completed games isolate question state", async (t) => {
  const { request } = await setup(t, false, 0);
  const lobby = (await request("host", "sync_lobby")).data.lobby;
  assert.equal(
    (
      await request("host", "update_teams", {
        teams: lobby.teams,
        players: [{ socketId: "outsider", teamId: 1 }],
      })
    ).type,
    "error",
  );
  const updated = await request("host", "update_teams", {
    teams: lobby.teams.map((t: any) => ({ ...t, teamScore: 99999 })),
    players: lobby.players,
  });
  assert.ok(updated.data.lobby.teams.every((t: any) => t.teamScore === 0));
  await request("host", "start_game");
  await beginRound(request);
  for (const answer of regular.answers.slice(0, 4))
    await request("host", "choose_team_answer", { answerChosen: answer });
  const complete = (await request("host", "sync_lobby")).data.lobby;
  assert.equal(complete.gameState, "round_end");
  assert.equal(complete.teams[0].teamScore, 102);
  assert.equal(regular.answers[0].answerSelected, undefined);
});

test("activity roster changes preserve play and late spectators cannot win the buzzer", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 100000 });
  const { game, request, code } = await setup(t, true, 0);
  await request("host", "start_game");
  await beginRound(request, true);
  let lobby = (await request("host", "begin_lightning_buzzer")).data.lobby;
  game.reconcileMembers(code, [
    { id: "host", name: "Host" },
    { id: "one", name: "One" },
    { id: "two", name: "Two" },
    { id: "stranger", name: "Spectator" },
  ]);
  lobby = (await request("host", "sync_lobby")).data.lobby;
  assert.equal(lobby.gameState, "lightning_round");
  assert.equal(
    lobby.players.find((p: any) => p.socketId === "stranger").teamId,
    false,
  );
  t.mock.timers.tick(6000);
  const c = lobby.lightningChallenge;
  const step =
    c.mode === "reaction"
      ? 0
      : Math.floor(
          (Date.now() - c.startedAt) / (c.mode === "moles" ? 1100 : 900),
        );
  const challenge = { step, target: challengeTarget(c.seed, step) };
  assert.equal(
    (await request("stranger", "lightning_buzz_in", { challenge })).type,
    "error",
  );
  assert.equal(
    (await request("host", "sync_lobby")).data.lobby.lightningRoundTeamIndex,
    undefined,
  );
  assert.equal(
    (await request("one", "lightning_buzz_in", { challenge })).type,
    "lobby_update",
  );
});

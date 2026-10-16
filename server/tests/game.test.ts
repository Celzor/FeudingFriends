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
  const request = Object.assign(
    async (id: string, type: string, data: any = {}) =>
      game.onMessage(sockets[id], { type, data: { ...data, lobbyCode: code } }),
    { finishReading: () => t.mock.timers.tick(10000) },
  );
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
async function beginRound(request: any, lightning = false, finishReading = true) {
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
  if (finishReading) request.finishReading();
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
    "pause_timer",
    "resume_timer",
    "end_round",
    "end_game",
    "return_to_lobby",
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
  assert.equal(lobby.timerStart, 117000);
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
  assert.equal(lobby.wrongAnswerDisabledUntil, undefined);
  assert.equal(lobby.roundResults.length, 1);
  assert.equal(lobby.roundResults[0].result, "incorrect");
});

test("timeout blocks duplicate wrong answers for exactly two seconds while correct answers remain available", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 100000 });
  const { request, events } = await setup(t, false, 10);
  await request("host", "start_game");
  const started = await beginRound(request);
  const timeoutAt = started.timerStart + 10000;
  t.mock.timers.tick(timeoutAt - Date.now());
  let lobby = (await request("host", "sync_lobby")).data.lobby;
  assert.equal(lobby.teams[0].wrongGuesses, 1);
  assert.equal(lobby.timerStart, timeoutAt);
  assert.equal(lobby.wrongAnswerDisabledUntil, timeoutAt + 2000);

  const assertWrongBlocked = async () => {
    const before = (await request("host", "sync_lobby")).data.lobby;
    const broadcasts = Object.values(events).map((list) => list.length);
    const response = await request("host", "choose_team_answer", {
      answerChosen: false,
      wrongAnswerDisabledUntil: 0,
    });
    assert.equal(response.type, "error");
    assert.deepEqual((await request("host", "sync_lobby")).data.lobby, before);
    assert.deepEqual(Object.values(events).map((list) => list.length), broadcasts);
  };
  await assertWrongBlocked();
  t.mock.timers.tick(500);
  const correct = await request("host", "choose_team_answer", {
    answerChosen: regular.answers[0],
  });
  assert.equal(correct.type, "lobby_update");
  assert.equal(correct.data.lobby.currentQuestion.answers[0].answerSelected, true);
  assert.equal(correct.data.lobby.timerStart, timeoutAt + 500);
  assert.equal(correct.data.lobby.wrongAnswerDisabledUntil, timeoutAt + 2000);
  t.mock.timers.tick(1499);
  await assertWrongBlocked();
  t.mock.timers.tick(1);
  const accepted = await request("host", "choose_team_answer", {
    answerChosen: false,
  });
  assert.equal(accepted.type, "lobby_update");
  lobby = accepted.data.lobby;
  assert.equal(lobby.teams[0].wrongGuesses, 2);
  assert.equal(lobby.timerStart, timeoutAt + 2000);
  assert.equal(lobby.wrongAnswerDisabledUntil, timeoutAt + 2000);
});

test("a manual wrong racing an elapsed timer cannot bypass the pending automatic strike", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 100000 });
  const { request, events } = await setup(t, false, 10);
  await request("host", "start_game");
  const before = await beginRound(request);
  const count = events.host.length;
  // Moving Date without dispatching timers reproduces a queued click arriving
  // after the deadline but before the timer callback gets CPU time.
  t.mock.timers.setTime(before.timerStart + 10000);
  assert.equal(
    (await request("host", "choose_team_answer", { answerChosen: false })).type,
    "error",
  );
  assert.deepEqual((await request("host", "sync_lobby")).data.lobby, before);
  assert.equal(events.host.length, count);
  t.mock.timers.tick(10000);
  const after = (await request("host", "sync_lobby")).data.lobby;
  assert.equal(after.teams[0].wrongGuesses, 1);
  assert.equal(after.revision, before.revision + 1);
  assert.equal(after.wrongAnswerDisabledUntil, Date.now() + 2000);
});

test("lightning timeout protects the next team's turn and clears protection at the reveal", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 100000 });
  const { request } = await setup(t, true, 10);
  await request("host", "start_game");
  await beginRound(request, true);
  const { lightningChallenge: challenge } = (
    await request("host", "begin_lightning_buzzer")
  ).data.lobby;
  t.mock.timers.tick(6000);
  const step =
    challenge.mode === "reaction"
      ? 0
      : Math.floor(
          (Date.now() - challenge.startedAt) /
            (challenge.mode === "moles" ? 1100 : 900),
        );
  await request("one", "lightning_buzz_in", {
    challenge: { step, target: challengeTarget(challenge.seed, step) },
  });
  t.mock.timers.tick(10000);
  const timeout = (await request("host", "sync_lobby")).data.lobby;
  assert.equal(timeout.gameState, "lightning_round");
  assert.equal(timeout.teams[0].wrongGuesses, 1);
  assert.equal(timeout.teams[1].wrongGuesses, 0);
  assert.equal(timeout.lightningRoundTeamIndex, 1);
  assert.equal(timeout.wrongAnswerDisabledUntil, 128000);
  for (const elapsed of [0, 1999]) {
    t.mock.timers.tick(elapsed);
    assert.equal(
      (await request("host", "choose_lightning_answer", { answerChosen: false }))
        .type,
      "error",
    );
    assert.deepEqual((await request("host", "sync_lobby")).data.lobby, timeout);
  }
  t.mock.timers.tick(1);
  const reveal = await request("host", "choose_lightning_answer", {
    answerChosen: false,
  });
  assert.equal(reveal.type, "lobby_update");
  assert.equal(reveal.data.lobby.gameState, "lightning_reveal");
  assert.equal(reveal.data.lobby.teams[1].wrongGuesses, 1);
  assert.equal(reveal.data.lobby.timerStart, undefined);
  assert.equal(reveal.data.lobby.wrongAnswerDisabledUntil, undefined);
  await request("host", "continue_lightning");
  const nextRound = await beginRound(request);
  assert.equal(nextRound.wrongAnswerDisabledUntil, undefined);
});

test("ending a round during cooldown clears it before the next board", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 100000 });
  const { request } = await setup(t, false, 10);
  await request("host", "start_game");
  await beginRound(request);
  t.mock.timers.tick(10001);
  assert.ok(
    (await request("host", "sync_lobby")).data.lobby.wrongAnswerDisabledUntil >
      Date.now(),
  );
  for (const answer of regular.answers.slice(0, 4))
    await request("host", "choose_team_answer", { answerChosen: answer });
  const finished = (await request("host", "sync_lobby")).data.lobby;
  assert.equal(finished.gameState, "round_end");
  assert.equal(finished.wrongAnswerDisabledUntil, undefined);
  await request("host", "end_round");
  const next = await beginRound(request);
  assert.equal(next.wrongAnswerDisabledUntil, undefined);
  const manualWrong = await request("host", "choose_team_answer", {
    answerChosen: false,
  });
  assert.equal(manualWrong.type, "lobby_update");
  assert.equal(manualWrong.data.lobby.teams[1].wrongGuesses, 1);
});

test("manual wrong answers do not introduce a cooldown with enabled or disabled timers", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 100000 });
  for (const seconds of [0, 10]) {
    const { request } = await setup(t, false, seconds);
    await request("host", "start_game");
    await beginRound(request);
    for (const strikes of [1, 2]) {
      const response = await request("host", "choose_team_answer", {
        answerChosen: false,
      });
      assert.equal(response.type, "lobby_update");
      assert.equal(response.data.lobby.teams[0].wrongGuesses, strikes);
      assert.equal(response.data.lobby.wrongAnswerDisabledUntil, undefined);
      if (seconds === 0) assert.equal(response.data.lobby.timerStart, undefined);
    }
  }
});

test("confirmed questions get ten seconds of reading before any answer or answer timer", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 100000 });
  for (const seconds of [0, 10]) {
    const { request, events } = await setup(t, false, seconds);
    await request("host", "start_game");
    const board = await beginRound(request, false, false);
    assert.equal(board.questionReadUntil, Date.now() + 10000);
    assert.equal(board.timerStart, seconds ? board.questionReadUntil : undefined);
    const broadcasts = events.host.length;
    for (const answerChosen of [false, regular.answers[0]])
      assert.equal(
        (await request("host", "choose_team_answer", { answerChosen })).type,
        "error",
      );
    t.mock.timers.tick(9999);
    assert.deepEqual((await request("host", "sync_lobby")).data.lobby, board);
    assert.equal(events.host.length, broadcasts);
    assert.equal(
      (await request("host", "choose_team_answer", { answerChosen: false })).type,
      "error",
    );
    t.mock.timers.tick(1);
    if (seconds) {
      t.mock.timers.tick(9999);
      assert.equal(
        (await request("host", "sync_lobby")).data.lobby.teams[0].wrongGuesses,
        0,
      );
      t.mock.timers.tick(1);
      assert.equal(
        (await request("host", "sync_lobby")).data.lobby.teams[0].wrongGuesses,
        1,
      );
    } else {
      assert.equal(
        (
          await request("host", "choose_team_answer", {
            answerChosen: regular.answers[0],
          })
        ).type,
        "lobby_update",
      );
    }
  }
});

test("host pause freezes the remaining answer time and resume never resets it", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 100000 });
  const { request, events } = await setup(t, false, 10);
  await request("host", "start_game");
  const board = await beginRound(request);
  assert.equal((await request("host", "resume_timer")).type, "error");
  t.mock.timers.tick(3500);
  const paused = await request("host", "pause_timer", { timerPausedAt: 0 });
  assert.equal(paused.type, "lobby_update");
  assert.equal(paused.data.lobby.timerPausedAt, 113500);
  assert.equal(paused.data.lobby.timerStart, board.timerStart);
  assert.equal((await request("host", "pause_timer")).type, "error");
  assert.equal((await request("one", "resume_timer")).type, "error");
  assert.equal((await request("stranger", "resume_timer")).type, "error");
  const count = events.host.length;
  for (const answerChosen of [false, regular.answers[0]])
    assert.equal(
      (await request("host", "choose_team_answer", { answerChosen })).type,
      "error",
    );
  t.mock.timers.tick(60000);
  assert.equal(events.host.length, count, "paused timers do not fire or broadcast");
  assert.deepEqual(
    (await request("host", "sync_lobby")).data.lobby,
    paused.data.lobby,
  );
  const resumed = await request("host", "resume_timer", { timerStart: Date.now() });
  assert.equal(resumed.type, "lobby_update");
  assert.equal(resumed.data.lobby.timerPausedAt, undefined);
  assert.equal(resumed.data.lobby.timerStart, board.timerStart + 60000);
  assert.equal(resumed.data.lobby.questionReadUntil, board.questionReadUntil);
  t.mock.timers.tick(6499);
  assert.equal(
    (await request("host", "sync_lobby")).data.lobby.teams[0].wrongGuesses,
    0,
  );
  t.mock.timers.tick(1);
  const timedOut = (await request("host", "sync_lobby")).data.lobby;
  assert.equal(timedOut.teams[0].wrongGuesses, 1);
  await request("host", "pause_timer");
  t.mock.timers.tick(5000);
  const resumedAfterTimeout = (await request("host", "resume_timer")).data.lobby;
  assert.equal(
    resumedAfterTimeout.wrongAnswerDisabledUntil,
    timedOut.wrongAnswerDisabledUntil,
    "the duplicate-click cooldown uses wall time rather than paused game time",
  );
  assert.equal(
    (await request("host", "choose_team_answer", { answerChosen: false })).type,
    "lobby_update",
  );
});

test("reading can be paused with answer timers enabled or off and resumes with the same reading time", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 100000 });
  for (const seconds of [0, 10]) {
    const { request } = await setup(t, false, seconds);
    await request("host", "start_game");
    const board = await beginRound(request, false, false);
    t.mock.timers.tick(4000);
    const paused = (await request("host", "pause_timer")).data.lobby;
    assert.equal(paused.timerPausedAt, Date.now());
    t.mock.timers.tick(30000);
    assert.deepEqual((await request("host", "sync_lobby")).data.lobby, paused);
    const resumed = (await request("host", "resume_timer")).data.lobby;
    assert.equal(resumed.questionReadUntil, board.questionReadUntil + 30000);
    assert.equal(
      resumed.timerStart,
      seconds ? board.timerStart + 30000 : undefined,
    );
    t.mock.timers.tick(5999);
    assert.equal(
      (
        await request("host", "choose_team_answer", {
          answerChosen: regular.answers[0],
        })
      ).type,
      "error",
    );
    t.mock.timers.tick(1);
    assert.equal(
      (
        await request("host", "choose_team_answer", {
          answerChosen: regular.answers[0],
        })
      ).type,
      "lobby_update",
    );
    if (seconds === 0)
      assert.equal((await request("host", "pause_timer")).type, "error");
  }
});

test("lightning reading and answer timers pause independently of the live buzzer challenge", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 100000 });
  const { request } = await setup(t, true, 10);
  await request("host", "start_game");
  await beginRound(request, true, false);
  assert.equal((await request("host", "begin_lightning_buzzer")).type, "error");
  t.mock.timers.tick(2000);
  const paused = (await request("host", "pause_timer")).data.lobby;
  t.mock.timers.tick(30000);
  assert.equal((await request("host", "begin_lightning_buzzer")).type, "error");
  assert.deepEqual((await request("host", "sync_lobby")).data.lobby, paused);
  const resumed = (await request("host", "resume_timer")).data.lobby;
  assert.equal(resumed.questionReadUntil, 140000);
  t.mock.timers.tick(8000);
  const buzzer = await request("host", "begin_lightning_buzzer");
  assert.equal(buzzer.type, "lobby_update");
  assert.equal(
    (await request("host", "pause_timer")).type,
    "error",
    "the live unclaimed buzzer is not a countdown",
  );
  const c = buzzer.data.lobby.lightningChallenge;
  t.mock.timers.tick(6000);
  const step =
    c.mode === "reaction"
      ? 0
      : Math.floor(
          (Date.now() - c.startedAt) / (c.mode === "moles" ? 1100 : 900),
        );
  const buzzed = await request("one", "lightning_buzz_in", {
    challenge: { step, target: challengeTarget(c.seed, step) },
  });
  assert.equal(buzzed.type, "lobby_update");
  t.mock.timers.tick(2500);
  assert.equal((await request("host", "pause_timer")).type, "lobby_update");
  t.mock.timers.tick(30000);
  assert.equal(
    (
      await request("host", "choose_lightning_answer", {
        answerChosen: lightning.answers[0],
      })
    ).type,
    "error",
  );
  assert.equal((await request("host", "resume_timer")).type, "lobby_update");
  t.mock.timers.tick(7499);
  assert.equal(
    (await request("host", "sync_lobby")).data.lobby.teams[0].wrongGuesses,
    0,
  );
  t.mock.timers.tick(1);
  const timedOut = (await request("host", "sync_lobby")).data.lobby;
  assert.equal(timedOut.teams[0].wrongGuesses, 1);
  assert.equal(timedOut.lightningRoundTeamIndex, 1);
});

test("a host cannot pause after an elapsed answer deadline to suppress the timeout", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 100000 });
  const { request } = await setup(t, false, 10);
  await request("host", "start_game");
  const board = await beginRound(request);
  t.mock.timers.setTime(board.timerStart + 10000);
  assert.equal((await request("host", "pause_timer")).type, "error");
  assert.deepEqual((await request("host", "sync_lobby")).data.lobby, board);
  t.mock.timers.tick(10000);
  assert.equal(
    (await request("host", "sync_lobby")).data.lobby.teams[0].wrongGuesses,
    1,
  );
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
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 100000 });
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

test("host can return a completed game to the same lobby and start a clean rematch", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 100000 });
  const { game, request, events, code } = await setup(t, true, 10);
  let lobby = (await request("host", "sync_lobby")).data.lobby;
  await request("host", "update_lobby_config", {
    lobbyConfig: { ...lobby.config, numberOfRounds: 1, winningScore: 500 },
  });
  lobby = (
    await request("host", "update_teams", {
      teams: [
        { teamId: 11, teamName: "The Champions" },
        { teamId: 22, teamName: "The Challengers" },
      ],
      players: lobby.players.map((p: any) => ({
        ...p,
        teamId: p.teamId * 11,
      })),
    })
  ).data.lobby;
  const config = lobby.config;
  assert.equal((await request("host", "return_to_lobby")).type, "error");

  await request("host", "start_game");
  await beginRound(request, true);
  const started = (await request("host", "begin_lightning_buzzer")).data.lobby;
  t.mock.timers.tick(6000);
  const challenge = started.lightningChallenge;
  const step =
    challenge.mode === "reaction"
      ? 0
      : Math.floor(
          (Date.now() - challenge.startedAt) /
            (challenge.mode === "moles" ? 1100 : 900),
        );
  await request("one", "lightning_buzz_in", {
    challenge: { step, target: challengeTarget(challenge.seed, step) },
  });
  await request("host", "choose_lightning_answer", {
    answerChosen: lightning.answers[0],
  });
  await request("host", "continue_lightning");
  await beginRound(request);
  assert.equal((await request("host", "return_to_lobby")).type, "error");
  for (const answer of regular.answers.slice(0, 4))
    await request("host", "choose_team_answer", { answerChosen: answer });
  assert.equal(
    (await request("host", "sync_lobby")).data.lobby.gameState,
    "game_end",
  );
  assert.equal((await request("host", "return_to_lobby")).type, "error");
  await request("host", "end_game");

  // A late Refract member remains a spectator rather than being reassigned by
  // the rematch. A server disconnect keeps its normal reconnection grace period.
  game.reconcileMembers(code, [
    { id: "host", name: "Host" },
    { id: "one", name: "One" },
    { id: "two", name: "Two" },
    { id: "stranger", name: "Spectator" },
  ]);
  const completed = (await request("host", "sync_lobby")).data.lobby;
  assert.equal(completed.gameState, "game_over");
  assert.equal(completed.teams[0].teamScore, 102);
  assert.equal(completed.questions.length, 1);
  assert.equal(completed.roundResults.length, 1);
  assert.ok(completed.lightningQuestion.answers[0].answerSelected);
  assert.equal((await request("one", "return_to_lobby")).type, "error");
  assert.equal((await request("stranger", "return_to_lobby")).type, "error");
  const reset = await request("host", "return_to_lobby", {
    lobbyConfig: { numberOfRounds: 99 },
    players: [],
    teams: [{ teamId: 999, teamName: "Forged", teamScore: 999 }],
    hostSocketId: "stranger",
  });
  assert.equal(reset.type, "lobby_update");
  lobby = reset.data.lobby;
  assert.equal(lobby.gameState, "lobby");
  assert.equal(lobby.lobbyCode, code);
  assert.equal(lobby.hostSocketId, completed.hostSocketId);
  assert.equal(lobby.hostName, completed.hostName);
  assert.deepEqual(lobby.config, config);
  assert.deepEqual(lobby.players, completed.players);
  assert.deepEqual(lobby.teams, [
    { teamId: 11, teamName: "The Champions", teamScore: 0, wrongGuesses: 0 },
    { teamId: 22, teamName: "The Challengers", teamScore: 0, wrongGuesses: 0 },
  ]);
  assert.equal(lobby.revision, completed.revision + 1);
  assert.notEqual(lobby.randomSeed, completed.randomSeed);
  assert.deepEqual(lobby.questions, []);
  for (const field of [
    "currentQuestion",
    "lightningQuestion",
    "lightningChallenge",
    "lightningRoundStarted",
    "lightningRoundTeamIndex",
    "roundResults",
    "currentRound",
    "currentTeamIndex",
    "suddenDeathTeamIndex",
    "timerStart",
    "wrongAnswerDisabledUntil",
    "questionReadUntil",
    "timerPausedAt",
  ])
    assert.equal(lobby[field], undefined, field);
  for (const id of ["host", "one", "two", "stranger"])
    assert.deepEqual(events[id].at(-1).data.lobby, lobby, id);

  assert.equal((await request("host", "return_to_lobby")).type, "error");
  const eventCounts = Object.fromEntries(
    Object.entries(events).map(([id, messages]) => [id, messages.length]),
  );
  t.mock.timers.tick(60000);
  for (const [id, count] of Object.entries(eventCounts))
    assert.equal(events[id].length, count, "old game timers must stay cancelled");
  assert.deepEqual((await request("host", "sync_lobby")).data.lobby, lobby);

  await request("host", "start_game");
  assert.equal(
    (
      await request("host", "begin_lightning_round", {
        question: completed.lightningQuestion,
      })
    ).type,
    "error",
    "a rematch requires a fresh referee question selection",
  );
  const freshLightning = await beginRound(request, true);
  assert.equal(freshLightning.lightningRoundStarted, false);
  assert.equal(freshLightning.lightningRoundTeamIndex, undefined);
  assert.equal(freshLightning.lightningChallenge.startedAt, 0);
  assert.ok(
    freshLightning.lightningQuestion.answers.every(
      (a: any) => !a.answerSelected,
    ),
  );
});

test("returning to the lobby preserves reconnect grace and removes departed players normally", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 100000 });
  const { game, request, sockets } = await setup(t, false, 10);
  const initial = (await request("host", "sync_lobby")).data.lobby;
  await request("host", "update_lobby_config", {
    lobbyConfig: { ...initial.config, numberOfRounds: 1 },
  });
  await request("host", "start_game");
  await beginRound(request);
  for (const answer of regular.answers.slice(0, 4))
    await request("host", "choose_team_answer", { answerChosen: answer });
  await request("host", "end_game");
  game.removeConnection(sockets.two);
  const reset = (await request("host", "return_to_lobby")).data.lobby;
  assert.deepEqual(reset.players, initial.players);
  t.mock.timers.tick(119999);
  assert.equal((await request("host", "sync_lobby")).data.lobby.players.length, 2);
  t.mock.timers.tick(1);
  assert.deepEqual(
    (await request("host", "sync_lobby")).data.lobby.players,
    initial.players.filter((p: any) => p.socketId !== "two"),
  );
});

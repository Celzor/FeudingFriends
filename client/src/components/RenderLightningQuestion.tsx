import React, { useContext } from "react";
import { DataContext } from "../providers/DataProvider";
import { AnswerButton, WrongAnswerButton } from "./AnswerButtons";
import LightningChallenge from "./LightningChallenge";
import Countdown from "./Countdown";
export default function RenderLightningQuestion() {
  const {
    lobbyData,
    isLobbyHost,
    answerLightningQuestion,
    startTheLightningBuzzer,
    continueLightning,
  } = useContext(DataContext);
  const reveal = lobbyData.gameState === "lightning_reveal";
  const question = lobbyData.lightningQuestion;
  const team = lobbyData.teams[lobbyData.lightningRoundTeamIndex];
  if (!question) return <p>Waiting for a question…</p>;
  const correct = question.answers.some((a) => a.answerSelected);
  return (
    <div>
      <div className="questionTitle">{question.question}</div>
      {reveal ? (
        <section
          className="lightningReveal"
          aria-label="Lightning round answers"
        >
          <h2>
            {correct
              ? `${team?.teamName} takes the lead!`
              : "Nobody got it — here’s the board!"}
          </h2>
          <p>
            {correct
              ? "The lightning answers are…"
              : "The host can now move on to the main game."}
          </p>
          <div className="answerButtonContainer">
            {question.answers.map((answer, index) => (
              <AnswerButton
                key={index}
                answer={answer}
                index={index}
                roundEnd
                onClick={() => {}}
              />
            ))}
          </div>
          {isLobbyHost ? (
            <button className="startButton" onClick={continueLightning}>
              Continue to main game
            </button>
          ) : (
            <p>Waiting for the host to continue…</p>
          )}
        </section>
      ) : (
        <>
          {!lobbyData.lightningRoundStarted && isLobbyHost && (
            <button className="startButton" onClick={startTheLightningBuzzer}>
              Start!
            </button>
          )}
          {lobbyData.lightningRoundStarted &&
            lobbyData.lightningRoundTeamIndex === undefined &&
            (isLobbyHost ? (
              <p className="flashAttention">
                Players, get ready to catch your buzzer!
              </p>
            ) : (
              <LightningChallenge />
            ))}
          {team && (
            <>
              <h2>
                {team.teamName}{" "}
                {lobbyData.teams.some((t) => t.wrongGuesses)
                  ? "is guessing..."
                  : "buzzed in!"}
              </h2>
              <Countdown />
              <div className="answerButtonContainer">
                {question.answers.map((answer, index) => (
                  <AnswerButton
                    key={index}
                    answer={answer}
                    index={index}
                    roundEnd={false}
                    onClick={() => {
                      if (isLobbyHost) void answerLightningQuestion(answer);
                    }}
                  />
                ))}
              </div>
              {isLobbyHost && (
                <WrongAnswerButton
                  onClick={() => answerLightningQuestion(false)}
                  roundEnd={false}
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

import React, { useContext, useEffect, useRef, useState } from "react";
import { DataContext } from "../providers/DataProvider";
import { WrongAnswerButton } from "./AnswerButtons";
import AnswerBoard from "./AnswerBoard";
import LightningChallenge from "./LightningChallenge";
import Countdown from "./Countdown";
import Celebration from "./Celebration";
import useGameSounds from "../hooks/useGameSounds";
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
  const correct = question?.answers.some((a) => a.answerSelected);
  const { playApplause, playWrong } = useGameSounds();
  const celebrated = useRef(false);
  const [celebrating, setCelebrating] = useState(false);
  useEffect(() => {
    if (!reveal || celebrated.current) return;
    celebrated.current = true;
    if (correct) playApplause({ onStart: () => setCelebrating(true) });
    else playWrong();
  }, [reveal]);
  if (!question) return <p>Waiting for a question…</p>;
  return (
    <div className="lightningQuestion">
      {celebrating && <Celebration intensity="round" />}
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
          <AnswerBoard
            answers={question.answers}
            roundEnd
            onAnswer={() => {}}
          />
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
              <AnswerBoard
                answers={question.answers}
                onAnswer={(answer) => {
                  if (isLobbyHost) void answerLightningQuestion(answer);
                }}
              />
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

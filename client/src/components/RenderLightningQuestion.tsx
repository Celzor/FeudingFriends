import React, { useMemo, useEffect, useContext, useState } from "react";

import "../scss/buttonAnimation.scss";
import "../scss/App.scss";
import { IAnswerType, IQuestionType, ITeamData } from "../../../types";

import { DataContext } from "../providers/DataProvider";

import { AnswerButton, WrongAnswerButton } from "./AnswerButtons";

// this needs to

export default function RenderLightningQuestion({ roundEnd = false }) {
  const {
    lobbyData,
    prevLobbyData,
    isLobbyHost,

    answerLightningQuestion,
    startTheLightningBuzzer,

    teamBuzzIn,
  } = useContext(DataContext);

  const [coordinates, setCoordinates] = useState({ x: '50%', y: '50%' });

  useEffect(() => {
    let intervalId;
    if (lobbyData.lightningRoundStarted) {
      intervalId = setInterval(() => {
        setCoordinates({
          x: `${Math.random() * 100}%`,
          y: `${Math.random() * 100}%`,
        });
      }, 738); // I like this number so I put it here, it's not prime though
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [lobbyData.lightningRoundStarted]);

  // either pring "team x buzzed in (for first round) or, "team x is guessing" for the second round++
  const teamText = useMemo(() => {
    if (lobbyData.lightningRoundTeamIndex == undefined) {
      return "";
    }

    let hasWrongAnswer = false;
    lobbyData.teams.forEach((team: ITeamData, index: number) => {
      const prevTeam = prevLobbyData.teams[index];
      if (prevTeam.wrongGuesses < team.wrongGuesses) {
        hasWrongAnswer = true;
      }
    });

    const teamData = lobbyData.teams[lobbyData.lightningRoundTeamIndex];

    // team buzzed in

    if (roundEnd) {
      return `${teamData.teamName} guessed the correct answer!`;
    }

    if (!hasWrongAnswer) {
      return `${teamData.teamName} buzzed in!`;
    }

    return `${teamData.teamName} is guessing...`;
  }, [lobbyData.lightningRoundTeamIndex, prevLobbyData, roundEnd]);

  let displayQuestion: IQuestionType = lobbyData.lightningQuestion;

  // // get the last question from questions array
  // if (roundEnd) {
  //   displayQuestion = lobbyData.questions[lobbyData.questions.length - 1];
  // }

  if (!displayQuestion) {
    return <div>There is no current question.</div>;
  }

  return (
    <div>
      <div className="questionTitle">{displayQuestion.question}</div>

      {/* host start game button */}
      {!lobbyData.lightningRoundStarted && isLobbyHost && (
        <button
          className="startButton"
          onClick={startTheLightningBuzzer}
          disabled={!isLobbyHost}
        >
          Start!
        </button>
      )}

      {/* the buzzer for teams */}
      {!isLobbyHost && lobbyData.lightningRoundStarted && lobbyData.lightningRoundTeamIndex == undefined && (
        <button
          className="buzzerButton"
          style={{ position: 'absolute', left: coordinates.x, top: coordinates.y }}
          onClick={teamBuzzIn}
        >
          Buzzer
        </button>
      )}

      {/* team status text */}
      {lobbyData.lightningRoundTeamIndex !== undefined && (
        <div>
          <h1>{teamText}</h1>
        </div>
      )}

      {/* question answers */}
      <div className="answerButtonContainer">
        {lobbyData.lightningRoundTeamIndex != undefined &&
          displayQuestion.answers.map((answer: IAnswerType, index: number) => {
            return (
              <AnswerButton
                key={index}
                answer={answer}
                onClick={async () =>
                  isLobbyHost && answerLightningQuestion(answer)
                }
                index={index}
                roundEnd={roundEnd}
              />
            );
          })}
      </div>

      {/* wrong answer button */}
      {isLobbyHost &&
        lobbyData.lightningRoundTeamIndex != undefined &&
        !roundEnd && (
          <WrongAnswerButton
            onClick={() => answerLightningQuestion(false)}
            roundEnd={roundEnd}
          />
        )}
    </div>
  );
}

import React, { useMemo, useEffect, useContext, useState } from "react";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faXmark } from "@fortawesome/free-solid-svg-icons";

import { IAnswerType, IQuestionType } from "../../../types";

import RenderQuestion from "../components/RenderQuestion";
import Countdown from "./Countdown";
import RenderLightningQuestion from "../components/RenderLightningQuestion";
import RoundEndStats from "../components/RoundEndStats";
import GameEnds from "../components/GameEnds";

import { DataContext } from "../providers/DataProvider";

import "../scss/buttonAnimation.scss";

// dialog to confirm question selection
function QuestionConfirm({ lightning = false }: { lightning?: boolean }) {
  const {
    lobbyData,

    // game functions
    advanceRound,
    beginLightningRound,
    hostGetQuestion,
    answerQuestion,
  } = useContext(DataContext);

  const [confirmingQuestion, setConfirmingQuestion] = useState<
    IQuestionType | false
  >(false);
  // get question when rendered and none set
  useEffect(() => {
    async function getTheFirstQuestion() {
      if (!lobbyData.currentQuestion) {
        const question = await hostGetQuestion(lightning);
        console.log("got question", question);
        setConfirmingQuestion(question);
      }
    }
    getTheFirstQuestion();
  }, []);

  const onConfirm = async () => {
    // hostConfirmQuestion();
    if (!confirmingQuestion) return;

    if (lightning) {
      await beginLightningRound(confirmingQuestion);
    } else {
      await advanceRound(confirmingQuestion);
    }
  };

  const onCancel = async () => {
    // get new question
    const question = await hostGetQuestion(lightning);
    setConfirmingQuestion(question);
  };

  if (!confirmingQuestion) return <div>Loading question… <button onClick={onCancel}>Try again</button></div>;

  return (
    <div>
      <h2 className="flashAttention">Select Your Question</h2>

      <b className="questionText">{confirmingQuestion.question}</b>
      <div className="answerListDiv">
        <ul className="answerList">
          {confirmingQuestion.answers.map(
            (answer: IAnswerType, index: number) => (
              <li key={index}>
                {answer.answerText} - ({answer.answerScore})
              </li>
            )
          )}
        </ul>
      </div>
      <div className="selectButtons">
        <button className="okButton" role="button" onClick={onConfirm}>
          <span className="okSpan">START</span>
          <div className="okIcon">
            <FontAwesomeIcon icon={faCheck} />
          </div>
        </button>
        <button className="skipButton" role="button" onClick={onCancel}>
          <span className="skipSpan">Skip it</span>
          <div className="skipIcon">
            <FontAwesomeIcon icon={faXmark} />
          </div>
        </button>
      </div>
    </div>
  );
}

export default function GameView() {
  const { lobbyData, roundSecondsLeft, startGame, hostEndRound, isLobbyHost } =
    useContext(DataContext);

  if (lobbyData.gameState === "host_set_question") {
    if (isLobbyHost) {
      return <QuestionConfirm />;
    } else {
      return <div>Waiting for host to select a question...</div>;
    }
  }

  if (lobbyData.gameState === "lightning_round_set_question") {
    if (isLobbyHost) {
      return <QuestionConfirm lightning={true} />;
    } else {
      return <div>Waiting for host to select a LIGHTNING question...</div>;
    }
  }

  if (lobbyData.gameState === "lightning_round" || lobbyData.gameState === "lightning_reveal") {
    return (
      <div>
        <h1>Lightning Round</h1>
        <div className="renderQuestion">
          <RenderLightningQuestion />
        </div>
      </div>
    );
  }

  if (lobbyData.gameState === "round") {
    // let gameStatus
    let gameStatusText = "Game Starting...";

    if (lobbyData.currentTeamIndex !== undefined) {
      gameStatusText =
        lobbyData.teams[lobbyData.currentTeamIndex].teamName + " is guessing";
    }

    // sudden death
    if (lobbyData.suddenDeathTeamIndex !== undefined) {
      gameStatusText =
        "CHANCE TO STEAL! - " +
        lobbyData.teams[lobbyData.suddenDeathTeamIndex].teamName +
        " is guessing";
    }

    return (
      <div className="mainGameQuestion">
        <h1>
          Round {lobbyData.currentRound + 1}

        </h1>
        <Countdown />
        <h3 className="currentTeamGuessing">{gameStatusText}</h3>

        <div className="renderQuestion">
          <RenderQuestion />
        </div>
      </div>
    );
  }

  if (
    lobbyData.gameState === "round_end" ||
    lobbyData.gameState === "game_end"
  ) {
    return <RoundEndStats />;
  }

  if (lobbyData.gameState === "game_over") {
    return <GameEnds />;
  }
}

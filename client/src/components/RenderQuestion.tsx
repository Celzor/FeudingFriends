import React, { useContext } from "react";

import { IAnswerType, IQuestionType } from "../../../types";

import { DataContext } from "../providers/DataProvider";

import { WrongAnswerButton } from "./AnswerButtons";
import AnswerBoard from "./AnswerBoard";

import "../scss/buttonAnimation.scss";

export default function RenderQuestion({ roundEnd = false }) {
  const { lobbyData, isLobbyHost, answerQuestion } = useContext(DataContext);

  let displayQuestion: IQuestionType = lobbyData.currentQuestion;

  // get the last question from questions array
  if (roundEnd) {
    displayQuestion = lobbyData.questions[lobbyData.questions.length - 1];
  }

  if (!displayQuestion) {
    return <div>There is no current question.</div>;
  }

  return (
    <div>
      <div className="questionTitle">{displayQuestion.question}</div>
      <AnswerBoard
        answers={displayQuestion.answers}
        onAnswer={(answer) => {
          if (isLobbyHost) void answerQuestion(answer);
        }}
        roundEnd={roundEnd}
      />
      {isLobbyHost && !roundEnd && (
        <WrongAnswerButton
          onClick={() => answerQuestion(false)}
          roundEnd={roundEnd}
        />
      )}

      <br />
    </div>
  );
}

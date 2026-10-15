import React, { useContext } from "react";

import { IAnswerType, IQuestionType } from "../../../types";

import { DataContext } from "../providers/DataProvider";

import { AnswerButton, WrongAnswerButton } from "./AnswerButtons";

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
      <div className="answerButtonContainer">
        {displayQuestion.answers.map((answer: IAnswerType, index: number) => {
          return (
            <AnswerButton
              key={index}
              answer={answer}
              onClick={async () => isLobbyHost && answerQuestion(answer)}
              index={index}
              roundEnd={roundEnd}
            />
          );
        })}
      </div>
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

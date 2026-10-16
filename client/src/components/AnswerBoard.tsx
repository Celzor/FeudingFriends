import type { IAnswerType } from "../../../types";
import { AnswerButton } from "./AnswerButtons";

type Props = {
  answers: IAnswerType[];
  onAnswer: (answer: IAnswerType) => void;
  roundEnd?: boolean;
};

export default function AnswerBoard({
  answers,
  onAnswer,
  roundEnd = false,
}: Props) {
  return (
    <div className="answerButtonContainer" data-testid="answer-board">
      {answers.map((answer, index) => (
        <AnswerButton
          key={index}
          answer={answer}
          index={index}
          roundEnd={roundEnd}
          onClick={() => onAnswer(answer)}
        />
      ))}
    </div>
  );
}

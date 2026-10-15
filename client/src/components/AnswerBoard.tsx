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
  const middle = Math.ceil(answers.length / 2);
  return (
    <div className="answerButtonContainer" data-testid="answer-board">
      {[answers.slice(0, middle), answers.slice(middle)].map((column, side) => (
        <div className="answerColumn" key={side}>
          {column.map((answer, index) => (
            <AnswerButton
              key={index + side * middle}
              answer={answer}
              index={index + side * middle}
              roundEnd={roundEnd}
              onClick={() => onAnswer(answer)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "csv-parse/sync";
import type { QuestionPools } from "../../shared/Game";
export const dataDirectory =
  process.env.QUESTION_DATA_DIR ||
  [resolve(__dirname, "../data"), resolve(__dirname, "../../../data")].find(
    (p) => existsSync(resolve(p, "1.csv")),
  )!;
export async function getQuestionPools(): Promise<QuestionPools> {
  const pools: QuestionPools = {};
  for (let n = 0; n <= 8; n++) {
    const rows: Record<string, string>[] = parse(
      await readFile(resolve(dataDirectory, `${n}.csv`)),
      { columns: true, bom: true },
    );
    pools[n] = rows
      .map((row) => {
        const values = Object.values(row);
        const answers = [];
        for (let i = 1; i < values.length; i += n <= 2 ? 1 : 2)
          if (values[i]?.trim())
            answers.push({
              answerText: values[i].trim(),
              answerScore:
                n <= 2 ? null : Number.parseInt(values[i + 1], 10) || 0,
            });
        return { question: values[0].trim(), answers };
      })
      .filter((q) => q.question && q.answers.length);
  }
  return pools;
}

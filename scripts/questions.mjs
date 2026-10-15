import { readFile, writeFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";
const pools = {};
for (let n = 0; n <= 8; n++) {
  const rows = parse(
    await readFile(new URL(`../server/data/${n}.csv`, import.meta.url)),
    { columns: true, bom: true },
  );
  pools[n] = rows
    .map((row) => {
      const values = Object.values(row);
      const answers = [];
      for (let i = 1; i < values.length; i += n <= 2 ? 1 : 2)
        if (String(values[i]).trim())
          answers.push({
            answerText: String(values[i]).trim(),
            answerScore:
              n <= 2 ? null : Number.parseInt(values[i + 1], 10) || 0,
          });
      return { question: String(values[0]).trim(), answers };
    })
    .filter((q) => q.question && q.answers.length);
}
await writeFile(
  new URL("../client/public/questions.json", import.meta.url),
  JSON.stringify(pools),
);

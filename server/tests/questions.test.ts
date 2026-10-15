import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse } from "csv-parse/sync";
import { dataDirectory, getQuestionPools } from "../src/questions";

const identity = (text: string) =>
  text
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");

test("all question sets contain complete, unique boards with valid scores and no duplicate answers", async () => {
  const pools = await getQuestionPools();
  const seen = new Map<string, string>();
  let count = 0;
  for (let pool = 0; pool <= 8; pool++) {
    const rows = parse(await readFile(resolve(dataDirectory, `${pool}.csv`)), {
      columns: true,
      bom: true,
    });
    assert.equal(
      rows.length,
      pools[pool].length,
      `pool ${pool}: rows must not be silently discarded`,
    );
    assert.ok(pools[pool].length > 0, `pool ${pool}: empty set`);
    for (const board of pools[pool]) {
      const location = `pool ${pool}: ${board.question}`;
      assert.ok(board.question.trim().length > 0, location);
      assert.ok(!/[�]|â€|Ã|\?\?/.test(board.question), location);
      const key = identity(board.question);
      assert.ok(!seen.has(key), `${location} duplicates ${seen.get(key)}`);
      seen.set(key, location);
      if (pool === 0)
        assert.ok(
          [3, 6, 7].includes(board.answers.length),
          `${location}: additional lightning answer count`,
        );
      else
        assert.equal(
          board.answers.length,
          pool < 3 ? pool + 3 : pool,
          `${location}: answer count`,
        );
      const answers = new Set<string>();
      for (const answer of board.answers) {
        const key = identity(answer.answerText);
        assert.ok(
          key.length > 0 && !/[�]|â€|Ã|\?\?/.test(answer.answerText),
          `${location}: incomplete answer`,
        );
        assert.ok(
          !answers.has(key),
          `${location}: duplicate answer ${answer.answerText}`,
        );
        answers.add(key);
        if (pool < 3) assert.equal(answer.answerScore, null, location);
        else
          assert.ok(
            Number.isInteger(answer.answerScore) &&
              answer.answerScore >= 0 &&
              answer.answerScore <= 100,
            `${location}: invalid score`,
          );
      }
      count++;
    }
  }
  assert.ok(count > 4000, "The full bank must be loaded, not a small sample.");
});

test("the generated Refract question data matches the server bank", async () => {
  const generated = JSON.parse(
    await readFile(
      resolve(dataDirectory, "../../client/public/questions.json"),
      "utf8",
    ),
  );
  assert.deepEqual(generated, await getQuestionPools());
});

test("all 131 ClassPoint questions are represented and Fast Money sheets were excluded", async () => {
  const pools = await getQuestionPools();
  const manifest = JSON.parse(
    await readFile(resolve(dataDirectory, "classpoint-import.json"), "utf8"),
  );
  const report = JSON.parse(
    await readFile(resolve(dataDirectory, "quality-report.json"), "utf8"),
  );
  assert.deepEqual(
    manifest.map((q: any) => q.number),
    Array.from({ length: 131 }, (_, i) => i + 1),
  );
  for (const entry of manifest)
    assert.ok(
      pools[entry.pool].some(
        (q) => identity(q.question) === identity(entry.question),
      ),
      `Missing ClassPoint question ${entry.number}`,
    );
  assert.equal(report.sources.classpoint_pdf.numbered_questions, 131);
  assert.ok(report.excluded_fast_money_worksheets["Fast Money"] > 0);
  assert.ok(report.excluded_fast_money_worksheets["Broken Fast Money"] > 0);
  assert.ok(
    Object.keys(report.sources.workbook.worksheets).every(
      (name) => !name.toLowerCase().includes("fast money"),
    ),
  );
  assert.equal(
    report.counts.output_questions,
    Object.values(pools).reduce((sum, questions) => sum + questions.length, 0),
  );
});

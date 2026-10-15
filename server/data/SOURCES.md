# Question bank sources and review

The CSV files are the source of truth for both the Node server and the generated static Refract activity data.

- `0.csv`: additional unscored lightning boards with three, six, or seven answers (unused columns are empty).
- `1.csv`: four-answer unscored lightning boards.
- `2.csv`: five-answer unscored lightning boards.
- `3.csv`–`8.csv`: scored main-game boards, grouped by their actual answer count.

## Imported sources — 2026-10-15

The review uses the two files supplied by the user:

1. **Family Feud Question Database.xlsx**, the supplied export of the [Google spreadsheet](https://docs.google.com/spreadsheets/d/1y5TtM4rXHfv_9BktCiJEW621939RzJucXxhJidJZbfQ/edit?gid=1151340645#gid=1151340645). All eleven non-Fast-Money worksheets are imported, including the extra `Sheet1` rows and all five unscored question tabs. The export has no reliable workbook modification timestamp; this is the user-supplied snapshot, not a claim of a live synchronization with Google.
2. **Family-Feud-Questions-and-Answers-PDF-by-ClassPoint.pdf**, supplied by the user, from [ClassPoint](https://cdn.classpoint.io/wp-content/uploads/Family-Feud-Questions-and-Answers-PDF-by-ClassPoint.pdf). All **131 numbered regular questions** are represented, including boards with eight answers. The PDF's PowerPoint tutorial is not question data and is excluded.

The workbook's **Fast Money** (803 rows) and **Broken Fast Money** (794 rows) tabs are excluded entirely. Unscored questions are used by the existing lightning round; Fast Money gameplay is not implemented.

`quality-report.json` records source SHA-256 checksums, worksheet counts, pool counts, and excluded incomplete questions. `classpoint-import.json` maps every numbered PDF question to its final board, including questions consolidated with existing spreadsheet entries.

## Cleanup results

The import processes 5,921 non-Fast-Money source rows and retains **5,581 unique boards**. It removes **333 duplicate question rows** and **7 duplicate answer entries**, and excludes **7 incomplete or invalid boards** whose missing text or survey values cannot be established reliably. Spelling, malformed apostrophes/encoding, grammar and answer labels are corrected. British spellings and legitimate names are preserved instead of blindly applying dictionary suggestions.

Duplicate matching ignores capitalization and punctuation and also uses manually reviewed paraphrase aliases. Questions with different meanings are kept separate even when their answers overlap. A single complete scored board is preferred over an unscored or less complete duplicate. Scores from separate survey versions are never added together. When an exact answer repeats within one board, only its higher original score is retained. Boards move to the set matching their actual answer count after duplicate answers are removed.

Unknown `??` placeholders are not playable answers. One malformed `9+` value is repaired to the supplied numeric score, 9; a board containing an unresolvable score of 121 is excluded rather than assigned an invented score.

## Repeat the import

Maintenance-only prerequisites: Python 3 with `openpyxl`, and Poppler's `pdftotext`. Application builds and runtime require neither of these; they read the reviewed CSV snapshot.

```sh
python3 scripts/import_question_sources.py \
  --workbook '/path/to/Family Feud Question Database.xlsx' \
  --pdf '/path/to/Family-Feud-Questions-and-Answers-PDF-by-ClassPoint.pdf'
npm test
npm run build
```

The reviewed corrections and paraphrase aliases live in `scripts/question-corrections.json`. To apply them to an existing CSV refresh without reimporting sources:

```sh
python3 scripts/clean_questions.py --source-dir /path/to/csvs --output-dir server/data
```

The cleanup is deterministic and is checked for repeatability. Tests check every board's answer count, score validity, question/answer uniqueness, placeholder/encoding cleanup, PDF coverage, and equality between the server bank and the generated Refract copy.

The public URLs were blocked by the cloud's network allowlist, so the imports use the uploads directly. Domain additions for `docs.google.com` and `cdn.classpoint.io` are saved in the environment draft for future downloads; they are not needed to build or run this imported snapshot.

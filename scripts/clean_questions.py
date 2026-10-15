#!/usr/bin/env python3
"""Apply reviewed editorial corrections and deduplicate the checked-in question bank.

No network access is performed. Survey scores from separate boards are never added.
Run from any directory: python3 scripts/clean_questions.py [--source-dir DIR] [--output-dir DIR]
"""
import argparse
import collections
import csv
import difflib
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RULES = json.loads((ROOT / 'scripts/question-corrections.json').read_text())


def normalize(text):
    text = re.sub(r'_x([0-9A-Fa-f]{4})_', lambda m: chr(int(m[1], 16)), text)
    # Repair the specific double-decoded UTF-8 punctuation present in the source.
    for broken, fixed in {'â€™': "'", 'â€˜': "'", 'â€œ': '"', 'â€\x9d': '"', 'â€¦': '...', '’': "'", '‘': "'", '“': '"', '”': '"', '–': '-', '—': '-'}.items():
        text = text.replace(broken, fixed)
    text = unicodedata.normalize('NFKC', text)
    return re.sub(r'\s+', ' ', text).strip()


def key(text):
    return ''.join(c for c in unicodedata.normalize('NFKD', normalize(text)).casefold() if c.isalnum())


QUESTION_FIXES = {key(k): v for k, v in RULES['questions'].items()}
EXCLUDED = {key(k): v for k, v in RULES['exclude_questions'].items()}
PHRASES = [(normalize(k), v) for k, v in RULES['phrases'].items()]


def edit(text, question=False, apply_aliases=True):
    text = normalize(text)
    if question:
        text = QUESTION_FIXES.get(key(text), text)
    # Phrases first to repair malformed contractions and truncated answer labels.
    for old, new in PHRASES:
        text = re.sub(r'(?<!\w)' + re.escape(old) + r'(?!\w)', lambda _m: new, text, flags=re.I)

    def replace_word(match):
        word = match.group()
        replacement = RULES['words'].get(word.casefold())
        if replacement is None and word.lower().endswith("'s"):
            base = RULES['words'].get(word[:-2].casefold())
            replacement = base + "'s" if base else None
        return replacement or word

    text = re.sub(r"[A-Za-z]+(?:'[A-Za-z]+)?", replace_word, text)
    for old, new in PHRASES:
        text = re.sub(r'(?<!\w)' + re.escape(old) + r'(?!\w)', lambda _m: new, text, flags=re.I)
    text = re.sub(r"(?<=[a-z])'([A-Z])\b", lambda m: "'" + m[1].lower(), text)
    text = re.sub(r'\b(Tv|Gps|Dvd|Cd|Cds|Dvds|Mp3|Atm|Iq|Usa|Ufo)\b', lambda m: m[0].upper(), text)
    text = re.sub(r'\s*/\s*', '/', text)
    text = re.sub(r'\bI\'(M|LL|VE|D)\b', lambda m: "I'" + m[1].lower(), text)
    text = re.sub(r'([,;:])(?=[A-Za-z])', r'\1 ', text)
    text = normalize(text)
    if question:
        text = text.rstrip(' ,.;')
        text = re.sub(r'([A-Za-z]{2,})\.([\"\'])$', r'\1\2', text)
        text = text[0].upper() + text[1:] if text else text
        if text and text[-1] not in '?!' and not re.search(r'[?!.][\"\']$', text):
            text += '?' if re.match(r'^(What|Why|Where|When|Who|Which|How|At What|In What|In Which)\b', text, re.I) else '.'
    if question and apply_aliases:
        seen = set()
        while key(text) in ALIASES and key(text) not in seen:
            seen.add(key(text))
            text = ALIASES[key(text)]
    return text


ALIASES = {key(edit(k, question=True, apply_aliases=False)): edit(v, question=True, apply_aliases=False) for k, v in RULES.get('question_aliases', {}).items()}


def clean(source):
    boards = []
    stats = collections.Counter()
    removed = []
    for pool in range(0, 9):
        file = source / f'{pool}.csv'
        if not file.exists() and pool in (0, 8):
            continue
        with file.open(newline='') as stream:
            reader = csv.reader(stream)
            next(reader)
            for line, row in enumerate(reader, 2):
                stats['input_questions'] += 1
                original = normalize(row[0])
                if not any(cell.strip() for cell in row):
                    stats['empty_rows_removed'] += 1
                    continue
                if key(original) in EXCLUDED:
                    stats['incomplete_questions_removed'] += 1
                    removed.append({'question': original, 'reason': EXCLUDED[key(original)]})
                    continue
                question = edit(row[0], question=True)
                answers = {}
                cells = [(text, None) for text in row[1:]] if pool < 3 else list(zip(row[1::2], row[2::2]))
                for text, raw_score in cells:
                    if not normalize(text) or re.fullmatch(r'[?\s]+', text):
                        if pool != 0 or normalize(text):
                            stats['blank_answers_removed'] += 1
                        continue
                    overrides = {normalize(k): v for k, v in RULES.get('answer_overrides', {}).get(row[0], {}).items()}
                    answer = edit(overrides.get(normalize(text), text))
                    if answer != normalize(text):
                        stats['answer_labels_corrected'] += 1
                    score = None
                    if raw_score is not None:
                        # The source contains one OCR-style "9+" value. Its numeric score is 9.
                        score_text = raw_score.strip()
                        if re.fullmatch(r'\d+\+', score_text):
                            stats['score_format_repairs'] += 1
                            score_text = score_text[:-1]
                        if not re.fullmatch(r'\d+', score_text):
                            raise ValueError(f'{pool}.csv:{line}: invalid score {raw_score!r}')
                        score = int(score_text)
                    identity = key(answer)
                    if identity in answers:
                        stats['duplicate_answers_removed'] += 1
                        if score is not None:
                            answers[identity]['score'] = max(score, answers[identity]['score'])
                    else:
                        answers[identity] = {'text': answer, 'score': score}
                answers = list(answers.values())
                if question != original:
                    stats['question_labels_corrected'] += 1
                if not question or len(answers) < 2:
                    raise ValueError(f'{pool}.csv:{line}: incomplete board')
                target = ({4: 1, 5: 2}.get(len(answers), 0)) if pool < 3 else len(answers)
                if pool < 3 and not 3 <= len(answers) <= 7:
                    raise ValueError(f'{pool}.csv:{line}: expected three to seven lightning answers')
                if pool >= 3 and not 3 <= target <= 8:
                    raise ValueError(f'{pool}.csv:{line}: unsupported regular board size {target}')
                if target != pool:
                    stats['boards_reclassified_by_answer_count'] += 1
                boards.append({'question': question, 'answers': answers, 'pool': target, 'source': f'{pool}.csv:{line}'})
    chosen = {}
    for board in boards:
        identity = key(board['question'])
        previous = chosen.get(identity)
        if previous:
            stats['duplicate_questions_removed'] += 1
            # Prefer scored, complete boards. Do not merge scores across surveys.
            priority = lambda b: (b['pool'] >= 3, len(b['answers']), sum(a['score'] or 0 for a in b['answers']))
            if priority(board) > priority(previous):
                chosen[identity] = board
        else:
            chosen[identity] = board
    result = list(chosen.values())
    stats['output_questions'] = len(result)
    return result, dict(stats), removed


def write(boards, output):
    output.mkdir(parents=True, exist_ok=True)
    for pool in range(0, 9):
        count = pool if pool >= 3 else (7 if pool == 0 else pool + 3)
        headers = ['Question']
        for i in range(1, count + 1):
            headers.append(f'Answer {i}')
            if pool >= 3:
                headers.append(f'#{i}')
        with (output / f'{pool}.csv').open('w', newline='') as stream:
            writer = csv.writer(stream, lineterminator='\n')
            writer.writerow(headers)
            for board in boards:
                if board['pool'] != pool:
                    continue
                row = [board['question']]
                for answer in board['answers']:
                    row.append(answer['text'])
                    if pool >= 3:
                        row.append(answer['score'])
                if pool == 0:
                    row += [''] * (len(headers) - len(row))
                writer.writerow(row)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', type=Path, default=ROOT / 'server/data')
    parser.add_argument('--output-dir', type=Path, default=ROOT / 'server/data')
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    boards, stats, removed = clean(args.source_dir)
    write(boards, args.output_dir)
    report = {'counts': stats, 'excluded': removed}
    if args.report:
        args.report.write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n')
    print(json.dumps(stats, indent=2))


if __name__ == '__main__':
    main()

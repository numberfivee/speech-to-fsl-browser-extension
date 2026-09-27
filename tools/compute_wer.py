"""
compute_wer.py

Computes Word Error Rate (Eq. 3.4 in the methodology chapter):

    WER = (S + D + I) / N

where S = substitutions, D = deletions, I = insertions, N = total
words in the reference transcript. Uses word-level Levenshtein
edit distance (the standard approach cited via Jurafsky & Martin).

USAGE

    Prepare two plain-text files, one utterance per line, in the
    same order:

        reference.txt   - what was actually said (ground truth)
        hypothesis.txt  - what the Web Speech API transcribed
                           (copy these from the "Recognized Speech"
                           field or the console's
                           "Accumulated Speech:" log during testing)

    Then run:

        python compute_wer.py reference.txt hypothesis.txt

    Optional: write per-line + aggregate results to CSV:

        python compute_wer.py reference.txt hypothesis.txt --csv wer_results.csv

EXAMPLE FILES

    reference.txt:
        magandang umaga po
        ako ay pupunta sa paaralan ngayon
        salamat po sa inyong tulong

    hypothesis.txt:
        magandang umaga po
        ako ay pupunta sa paaralan ngaon
        salamat po sa inyo tulong
"""

import argparse
import csv
import sys
from pathlib import Path


def normalize(text: str) -> list[str]:
    """Lowercase, strip punctuation, split into words. Mirrors
    normalizeText() in translator.js so WER is measured on the
    same normalized form the translator actually consumes."""

    cleaned = text.lower().strip()

    for ch in ".,!?;:¿¡\"'":
        cleaned = cleaned.replace(ch, "")

    return [w for w in cleaned.split() if w]


def word_edit_distance(reference: list[str], hypothesis: list[str]) -> dict:
    """
    Standard DP word-level edit distance, tracking substitutions,
    deletions, and insertions separately (not just total distance),
    since Eq. 3.4 needs S, D, I individually.
    """

    n = len(reference)
    m = len(hypothesis)

    # dp[i][j] = (cost, S, D, I) for aligning ref[:i] to hyp[:j]
    dp = [[(0, 0, 0, 0)] * (m + 1) for _ in range(n + 1)]

    for i in range(1, n + 1):
        dp[i][0] = (i, 0, i, 0)  # all deletions

    for j in range(1, m + 1):
        dp[0][j] = (j, 0, 0, j)  # all insertions

    for i in range(1, n + 1):
        for j in range(1, m + 1):

            if reference[i - 1] == hypothesis[j - 1]:
                dp[i][j] = dp[i - 1][j - 1]
                continue

            sub_cost, sub_s, sub_d, sub_i = dp[i - 1][j - 1]
            sub = (sub_cost + 1, sub_s + 1, sub_d, sub_i)

            del_cost, del_s, del_d, del_i = dp[i - 1][j]
            deletion = (del_cost + 1, del_s, del_d + 1, del_i)

            ins_cost, ins_s, ins_d, ins_i = dp[i][j - 1]
            insertion = (ins_cost + 1, ins_s, ins_d, ins_i + 1)

            dp[i][j] = min(sub, deletion, insertion, key=lambda x: x[0])

    total_cost, subs, dels, ins = dp[n][m]

    return {
        "substitutions": subs,
        "deletions": dels,
        "insertions": ins,
        "reference_words": n,
        "wer": (subs + dels + ins) / n if n > 0 else 0.0
    }


def main():

    parser = argparse.ArgumentParser(description="Compute Word Error Rate")
    parser.add_argument("reference", type=Path, help="Reference transcript file")
    parser.add_argument("hypothesis", type=Path, help="ASR hypothesis transcript file")
    parser.add_argument("--csv", type=Path, default=None, help="Optional CSV output path")

    args = parser.parse_args()

    ref_lines = args.reference.read_text(encoding="utf-8").splitlines()
    hyp_lines = args.hypothesis.read_text(encoding="utf-8").splitlines()

    if len(ref_lines) != len(hyp_lines):
        print(
            f"WARNING: reference has {len(ref_lines)} lines, "
            f"hypothesis has {len(hyp_lines)} lines. "
            "They should be paired one-to-one, per utterance.",
            file=sys.stderr
        )

    results = []
    total_s = total_d = total_i = total_n = 0

    for idx, (ref_line, hyp_line) in enumerate(zip(ref_lines, hyp_lines), start=1):

        ref_words = normalize(ref_line)
        hyp_words = normalize(hyp_line)

        result = word_edit_distance(ref_words, hyp_words)
        result["line"] = idx
        result["reference_text"] = ref_line
        result["hypothesis_text"] = hyp_line

        results.append(result)

        total_s += result["substitutions"]
        total_d += result["deletions"]
        total_i += result["insertions"]
        total_n += result["reference_words"]

        print(
            f"Line {idx:>3}: WER = {result['wer']:.3f}  "
            f"(S={result['substitutions']}, D={result['deletions']}, "
            f"I={result['insertions']}, N={result['reference_words']})"
        )

    overall_wer = (total_s + total_d + total_i) / total_n if total_n > 0 else 0.0

    print("\n" + "-" * 50)
    print(f"Overall WER: {overall_wer:.4f}  ({overall_wer * 100:.2f}%)")
    print(f"Total: S={total_s}, D={total_d}, I={total_i}, N={total_n}")
    print("-" * 50)

    if args.csv:

        with open(args.csv, "w", newline="", encoding="utf-8") as f:

            writer = csv.DictWriter(
                f,
                fieldnames=[
                    "line", "reference_text", "hypothesis_text",
                    "substitutions", "deletions", "insertions",
                    "reference_words", "wer"
                ]
            )

            writer.writeheader()

            for r in results:
                writer.writerow(r)

            writer.writerow({
                "line": "OVERALL",
                "reference_text": "",
                "hypothesis_text": "",
                "substitutions": total_s,
                "deletions": total_d,
                "insertions": total_i,
                "reference_words": total_n,
                "wer": round(overall_wer, 4)
            })

        print(f"\nWrote results to {args.csv.resolve()}")


if __name__ == "__main__":
    main()
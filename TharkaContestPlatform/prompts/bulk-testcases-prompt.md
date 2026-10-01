You are writing test cases for ONE problem on a school programming-contest
platform (Tharka Codex). Students solve it in **C++**. The admin uploads your
result as two .txt files in the problem editor's "Test Cases" tab (Sample or
Hidden uploader): one file with all the inputs, one with all the matching
outputs. A wrong expected output marks correct students as wrong in a real
contest, so every output must be correct.

## Step 0 - ask first if anything is unclear

You need: the full problem statement, the input format, the output format, the
constraints, and whether I want Sample cases, Hidden cases, or both. If ANY of
this is missing or ambiguous (for example, what to print in a special case),
reply ONLY with a short numbered list of questions and wait for my answers.

## How many

- Sample: AT LEAST 2 (unless I say otherwise).
- Hidden: AT LEAST 10 (unless I say otherwise).
- All different. Never repeat a sample case among the hidden ones.

## What the cases must cover (hidden)

- the smallest allowed values,
- the largest allowed values (choose ones whose answer you can still compute
  exactly),
- edge cases: 0, 1, negative numbers if allowed, equal values, duplicates,
  already-sorted / reverse-sorted, a single element, empty-looking cases if
  the statement allows them,
- several normal mixed cases.

Every input must follow the input format and the constraints exactly (right
number of values, right order, values inside the limits).

## File format

- The INPUT file holds all inputs in order; the OUTPUT file holds the matching
  outputs in the SAME order. Both must contain the same number of test cases.
- Separate test cases with a line containing exactly this, nothing else:

      ===TESTCASE===

- Put the separator only BETWEEN cases (N cases = N-1 separator lines), never
  before the first or after the last.
- Each output must be exactly what a correct C++ program prints: no labels
  like "Output:", no extra spaces at the start of lines (unless the shape is
  the answer), integers without ".0", exactly the decimal places the statement
  asks for.
- Plain text only. No markdown, no numbering, no comments inside the files.

Example (3 cases of "add two numbers"):

INPUT file:

    5 7
    ===TESTCASE===
    100 200
    ===TESTCASE===
    -3 3

OUTPUT file:

    12
    ===TESTCASE===
    300
    ===TESTCASE===
    0

## Double-check every case

1. Write a short, correct C++ reference solution for the problem.
2. Compute each output by following that solution step by step.
3. Compute each output a SECOND time independently (another method, or redo
   the arithmetic carefully). If the two results differ, find the mistake and
   fix it.
4. Count: the number of cases in the INPUT file equals the number in the
   OUTPUT file.

## How to reply

Reply in exactly three parts:

**Part 1 - CHECK** (plain text, short): the C++ reference solution, then one
line per case: "Case k: input -> output (computed twice, same)".

**Part 2 - INPUT FILE**: one code block with the complete input file content.

**Part 3 - OUTPUT FILE**: one code block with the complete output file content.

If I asked for both Sample and Hidden, give Parts 2-3 twice, clearly labeled
"SAMPLE" and "HIDDEN".

---

Here is the problem (statement, input format, output format, constraints) and
which test cases I want (Sample / Hidden / both, and how many):

[PASTE THE PROBLEM HERE]

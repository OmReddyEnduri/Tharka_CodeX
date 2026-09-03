You are generating test case files for a programming contest platform. Your
job is to output **two plain text blocks** — one for the input file, one for
the matching output file — in the exact format described below. Do not wrap
them in JSON. Do not add explanation inside the blocks themselves (put any
notes for me outside the blocks, clearly separated).

## What this is for

This produces the content for **two `.txt` files** that get uploaded through
the "Test Cases" tab of a single problem's editor (either the Sample Test
Cases uploader or the Hidden Test Cases uploader — I'll tell you which, or I
may want both). Each file can hold **one or many test cases**.

## Format rules

- One file holds all the **inputs**, in order. The other file holds all the
  matching **outputs**, in the same order. They must contain the same
  number of test cases.
- If there's more than one test case, separate them with a line containing
  **exactly** this and nothing else on that line:
  ```
  ===TESTCASE===
  ```
  No extra spaces, no markdown, no numbering — just that literal line.
- A file with **zero** `===TESTCASE===` lines is exactly one test case (the
  whole file).
- Don't add a trailing `===TESTCASE===` after the last test case — only put
  it *between* test cases (N test cases need N−1 delimiter lines).
- Trailing blank lines at the end are fine, they get trimmed automatically.
- Match each output exactly to what the reference/correct solution would
  print for that input (see "How to respond" below) — don't guess.

## Example: 3 test cases, one input file + one output file

**Input file content:**
```
5 7
===TESTCASE===
100 200
===TESTCASE===
-3 3
```

**Output file content:**
```
12
===TESTCASE===
300
===TESTCASE===
0
```

(That's a made-up "add two numbers" example — replace with real
input/output for the actual problem below.)

## How to respond

1. Output exactly two labeled blocks, in this order, each in its own code
   fence so I can tell where one ends and the other begins:
   - `INPUT FILE:` followed by a code block with the input content.
   - `OUTPUT FILE:` followed by a code block with the matching output
     content.
2. You must work out each output by actually solving the problem correctly
   for that input (using a correct reference solution/reasoning) — never
   fabricate a plausible-looking but wrong output. If you're not confident
   an output is correct for a given input, say so outside the code blocks
   instead of silently guessing.
3. If I gave you the inputs but not a way to compute the outputs (e.g. no
   reference solution and an ambiguous problem statement), ask me to
   clarify rather than inventing outputs.

---

Now here is the problem and the test case inputs (and, if I have them,
expected outputs) I want you to turn into this format. Tell me whether these
are meant to be **Sample** (visible to students) or **Hidden** (judging
only) test cases if it's not obvious:

[PASTE THE PROBLEM STATEMENT AND TEST CASE INPUTS/OUTPUTS HERE]

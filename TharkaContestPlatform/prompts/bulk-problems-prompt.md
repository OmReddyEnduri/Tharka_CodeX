You are writing an import file for a school programming-contest platform
(Tharka Codex). Students solve the problems in **C++**. The admin uploads your
JSON on the admin site: open an EXISTING contest -> "Bulk Add". This file
only adds problems to that contest - it does not create a contest. Your file must import
cleanly AND every test case must be correct - a wrong expected output marks
correct students as wrong in a real contest, so correctness matters more than
speed.

## Step 0 - ask first if anything is unclear

Before writing anything, check that you know: how many problems, the topics,
the difficulty of each, and the students' class/level. If ANY of these is missing or
unclear, reply ONLY with a short numbered list of questions and wait for my
answers. Do not guess and do not produce the file yet.

## Step 1 - write every problem completely

Every problem must have ALL of these fields filled in properly - no field left
empty, no placeholders like "..." or "TBD":

| Field | What to write |
|---|---|
| `title` | Short, clear name, e.g. "Multiplication Table". |
| `description` | The full statement in plain sentences: what the program reads, what it must compute, and exactly what it must print. Mention every rule a student needs (ranges, what to do with special cases). Use "\n\n" between paragraphs. |
| `inputFormat` | Line by line, exactly what the input contains, e.g. "A single line containing one integer N." |
| `outputFormat` | Exactly what to print, with the precise format, e.g. "Print 10 lines. Line i must be: N x i = result" |
| `constraints` | The limits for every input value, e.g. "1 <= N <= 1000". Every test case must respect these. |
| `category` | Topic, e.g. "Loops", "Arrays", "Strings", "Math", "Conditions", "Patterns". |
| `difficulty` | Exactly "Easy", "Medium" or "Hard". |
| `points` | 100 for Easy, 200 for Medium, 300 for Hard (unless I say otherwise). |
| `timeLimit` | Milliseconds. 1000 for normal problems, 2000 for heavier ones. |
| `memoryLimit` | Megabytes. Use 256. |
| `checker` | How the student's output is compared - choose with the guide in Step 2. |
| `sampleTestCases` | AT LEAST 2 test cases (shown to students). |
| `hiddenTestCases` | AT LEAST 10 test cases (used for judging, never shown). |

### PLAIN TEXT ONLY - NO MARKDOWN

The platform shows every text field exactly as written. Markdown is NOT
rendered, so `**N**` appears to students as **N** with the stars visible.
Never use `*`, `**`, `_`, `#`, backticks or code fences in any text field.

- WRONG: "Write a program that reads an integer **N** and prints `N x i = result`."
- RIGHT: "Write a program that reads an integer N and prints the multiplication
  table of N from 1 to 10. Print each line in the form: N x i = result"

Write variable names plainly (N, A, B), and put example output lines after a
colon or on their own line using "\n".

## Step 2 - choose the right checker

The checker decides how the student's output is compared with the expected
output. Every checker already ignores trailing spaces and blank lines at the
very end of the output.

| `checker` | Use it when | Example |
|---|---|---|
| `"token"` | Only the sequence of numbers/words matters; spaces and line breaks don't. **The default - use it for most problems.** | Sum of two numbers, a list of numbers |
| `"om"` | The answer has several meaningful lines (line count and order matter), but spacing inside a line is just formatting. | Multiplication table "5 x 1 = 5" (5x1=5 also accepted) |
| `"exact"` | The shape is the answer: leading spaces and line layout must match exactly. | Star pyramids, patterns, aligned shapes |
| `"numeric"` | The answer is a decimal number; tiny rounding differences must be accepted (~6 significant digits). State the precision in outputFormat, e.g. "Print the answer with 2 digits after the decimal point." | Area of a circle, average |
| `"unordered"` | The statement says the values may be printed in any order. | "Print all divisors of N in any order" |
| `"custom"` | Needs a rule the others don't have, e.g. YES/yes both accepted. Add `checkerConfig` (see below). | Case-insensitive YES/NO |
| `"code"` | Many different outputs are correct and a fixed rule can't decide. Add `checkerCode` (see below). | "Print any 3 numbers whose sum is N" style problems |

Pick the simplest checker that is correct. Do not use `"exact"` unless the
spacing really is the answer.

`"custom"` needs a `checkerConfig` object, for example (case-insensitive,
compared line by line):

    "checkerConfig": { "compareAs": "lines", "ignoreCase": true, "ignoreWhitespace": true, "ignoreBlankLines": true, "ignoreChars": "", "numberTolerance": null }

(`compareAs` is "lines" or "tokens"; `ignoreChars` lists characters to delete
before comparing, e.g. ","; `numberTolerance` is a small number like 0.000001
for "tokens" mode, or null.)

`"code"` needs `checkerCode`: a C++ function that returns true when the
student's output is correct. `<bits/stdc++.h>` and `using namespace std;` are
already included - write only the function (helpers allowed):

    bool checker(string expected, string user) {
        // expected = this test case's expected output, user = the student's output
        // both use "\n" line endings, trailing spaces/newlines at the end removed
        ...
        return true or false;
    }

IMPORTANT: the checker sees ONLY `expected` and `user` - NOT the input. So use
`"code"` only when correctness can be decided from those two strings (e.g.
"same numbers in any order with duplicates", "within a custom tolerance").
Inside JSON the code is one string: write line breaks as \n and quotes as \".

## Step 3 - test cases (the most important part)

Each test case is `{ "input": "...", "output": "..." }`, the exact text the
program reads and the exact text a correct program prints.

Rules:
1. **At least 2 sample and at least 10 hidden test cases per problem.** All
   different. Do not copy the samples into the hidden ones.
2. Every input must follow inputFormat and constraints exactly (right number of
   values, right order, values inside the limits).
3. Hidden cases must cover: the smallest allowed values, the largest allowed
   values, edge cases (0, 1, negative numbers if allowed, equal values,
   duplicates, already-sorted, single element), and normal mixed cases.
4. Keep values small enough that you can compute the answer by hand with
   certainty. For "largest value" cases pick ones whose answer you can still
   compute exactly (e.g. with a formula).
5. Outputs must be exactly what a correct C++ program prints: no extra spaces,
   no labels like "Output:", integers without ".0", the exact decimal places the
   statement asks for.
6. Multi-line input/output: use "\n" inside the JSON string, e.g. "3\n1 2 3".

### Double-check every test case

For each problem:
1. Write a short, correct C++ reference solution.
2. Compute each test case's output by following that solution step by step.
3. Compute each output a SECOND time independently (another method, or redo
   the arithmetic carefully). If the two results differ, find the mistake and
   fix it.
4. Re-read the statement and confirm the outputFormat matches the outputs
   exactly (spacing, order, line breaks).

## Shape of the file

A JSON array of problem objects:

    [
      {
        "title": "Multiplication Table",
        "description": "Write a program that reads an integer N and prints the multiplication table of N from 1 to 10.\n\nEach line must have the form: N x i = result",
        "inputFormat": "A single line containing one integer N.",
        "outputFormat": "Print exactly 10 lines. Line i (from 1 to 10) must be: N x i = result",
        "constraints": "1 <= N <= 1000",
        "category": "Loops",
        "difficulty": "Easy",
        "points": 100,
        "timeLimit": 1000,
        "memoryLimit": 256,
        "checker": "om",
        "sampleTestCases": [
          { "input": "2", "output": "2 x 1 = 2\n2 x 2 = 4\n2 x 3 = 6\n2 x 4 = 8\n2 x 5 = 10\n2 x 6 = 12\n2 x 7 = 14\n2 x 8 = 16\n2 x 9 = 18\n2 x 10 = 20" },
          { "input": "7", "output": "7 x 1 = 7\n7 x 2 = 14\n7 x 3 = 21\n7 x 4 = 28\n7 x 5 = 35\n7 x 6 = 42\n7 x 7 = 49\n7 x 8 = 56\n7 x 9 = 63\n7 x 10 = 70" }
        ],
        "hiddenTestCases": [
          { "input": "1", "output": "1 x 1 = 1\n1 x 2 = 2\n1 x 3 = 3\n1 x 4 = 4\n1 x 5 = 5\n1 x 6 = 6\n1 x 7 = 7\n1 x 8 = 8\n1 x 9 = 9\n1 x 10 = 10" }
        ]
      }
    ]

(The example shows only 1 hidden case to stay short - yours must have at least 10.)

## How to reply

Reply in exactly two parts:

**Part 1 - CHECK** (plain text, keep it short). For each problem: the C++
reference solution, then one line per test case: "Case k: input -> output
(computed twice, same)". Mention any problem you changed while checking.

**Part 2 - FILE**: the complete JSON in ONE ```json code block, nothing after
it. It must be valid JSON: double quotes only, no comments, no trailing commas,
no real line breaks inside strings (use \n), every field from Step 1 filled.
I will save that block as a .json file and upload it.

---

Here is what I want:

[DESCRIBE THE PROBLEMS: class/level, how many, topics, difficulty of each]

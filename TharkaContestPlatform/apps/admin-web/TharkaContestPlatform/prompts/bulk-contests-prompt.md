You are generating an import file for a programming contest platform. Your
only job is to output a single valid JSON value in the exact shape described
below — nothing else: no markdown code fences, no explanation, no comments,
no trailing commas. If information I give you is missing a field, either
omit that optional field entirely or make a reasonable choice for a required
one — never invent fake test data silently for **hidden** test cases without
saying so outside the JSON (see "How to respond" at the bottom).

## What this file is for

This JSON creates one or more **whole contests** in one shot — each contest
can carry its own list of **problems**, and each problem can carry its own
**sample and hidden test cases**. Every level is optional: a contest with no
problems yet, or a problem with no test cases yet, are both valid — just
omit that field or use an empty array.

## Top-level shape

A JSON array of contest objects (a bare `{ "contests": [...] }` wrapper is
also accepted, but prefer the bare array):

```json
[
  { ...contest... },
  { ...contest... }
]
```

## Contest object fields

| Field | Required? | Type | Notes |
|---|---|---|---|
| `id` | no | string | Omit it — the platform generates a unique one. Only set it if I gave you a specific id to reuse. |
| `name` | **yes** | string | Contest title. |
| `description` | no | string | Plain text or short blurb. |
| `startTime` | **yes** | string | `YYYY-MM-DDTHH:mm` (24-hour, no timezone/seconds), e.g. `"2026-09-05T10:00"`. |
| `endTime` | **yes** | string | Same format as `startTime`, must be after it. |
| `problems` | no | array of Problem objects | Omit or use `[]` for a contest with no problems yet. |

## Problem object fields (inside a contest's `problems` array)

| Field | Required? | Type | Notes |
|---|---|---|---|
| `id` | no | number | Omit it — the platform generates a unique one. Only set it if I gave you a specific id to reuse an existing problem (in which case every other field on that entry is ignored by the platform, so just include `id` alone). |
| `title` | **yes** (for a new problem) | string | |
| `description` | **yes** (for a new problem) | string | The full problem statement. Markdown is supported (use `**bold**`, code fences, etc.). |
| `category` | no | string | e.g. `"Arrays"`, `"DP"`, `"Graphs"`. Defaults to `"General"` if omitted. |
| `difficulty` | **yes** (for a new problem) | string | Exactly one of `"Easy"`, `"Medium"`, `"Hard"`. |
| `constraints` | no | string | e.g. `"1 <= n <= 10^5"`. |
| `inputFormat` | no | string | Defaults to `"Standard Input"`. |
| `outputFormat` | no | string | Defaults to `"Standard Output"`. |
| `timeLimit` | no | number | Milliseconds. Defaults to `1000`. |
| `memoryLimit` | no | number | Megabytes. Defaults to `256`. |
| `sampleTestCases` | no | array of TestCase objects | Shown to students on the problem page. Omit or `[]` if none yet. |
| `hiddenTestCases` | no | array of TestCase objects | Used for judging, never shown to students while the contest is live. Omit or `[]` if none yet. |

## TestCase object

```json
{ "input": "5 7", "output": "12" }
```

- `input` and `output` are both plain strings (the exact stdin the program
  receives and the exact stdout it must produce).
- For multi-line input/output, use `\n` inside the JSON string, e.g.
  `"input": "3\n1 2 3\n"`.
- Output should not have a trailing newline unless the judged program is
  actually expected to print one — match whatever the reference solution
  outputs.

## Full example

```json
[
  {
    "name": "Weekly Contest 1",
    "description": "First weekly practice contest.",
    "startTime": "2026-09-05T10:00",
    "endTime": "2026-09-05T13:00",
    "problems": [
      {
        "title": "Two Sum",
        "description": "Given an array of integers `nums` and an integer `target`, return the two numbers that add up to `target`.",
        "category": "Arrays",
        "difficulty": "Easy",
        "constraints": "2 <= nums.length <= 10^4",
        "timeLimit": 1000,
        "memoryLimit": 256,
        "sampleTestCases": [
          { "input": "4\n2 7 11 15\n9", "output": "0 1" }
        ],
        "hiddenTestCases": [
          { "input": "4\n3 2 4 6\n6", "output": "1 2" },
          { "input": "2\n3 3\n6", "output": "0 1" }
        ]
      },
      {
        "title": "Problem With No Test Cases Yet",
        "description": "Statement to be finalized.",
        "difficulty": "Medium"
      }
    ]
  },
  {
    "name": "Weekly Contest 2 (empty, problems added later)",
    "startTime": "2026-09-12T10:00",
    "endTime": "2026-09-12T13:00"
  }
]
```

## How to respond

1. Output **only** the JSON value described above — no surrounding text, no
   ```json fences.
2. If I asked you to also write the **hidden** test cases yourself (rather
   than me supplying them), you must actually work out correct
   input/output pairs from the problem statement and a correct reference
   solution — never fabricate plausible-looking but wrong outputs. If you
   are not confident an output is correct, leave `hiddenTestCases` empty
   for that problem instead of guessing.
3. If something I asked for doesn't fit a required field (e.g. no clear
   difficulty), pick the most reasonable value rather than leaving the file
   invalid.

---

Now here is what I want you to turn into this format:

[PASTE YOUR CONTEST(S)/PROBLEM(S)/TESTCASE DETAILS HERE]

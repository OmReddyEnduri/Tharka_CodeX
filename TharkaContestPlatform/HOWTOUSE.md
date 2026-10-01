# How to use

## 1. Test case file format (admin problem editor)

In the admin app's "Add/Edit Problem" panel, the Sample Test Cases and Hidden
Test Cases sections each have a file uploader: pick some **input files** and
some **output files**, then click **Load Pairs**.

**Pairing rule:** files are matched by **sorted filename order** across the
two pickers — not by matching names. Pick `1.txt`, `2.txt`, `3.txt` as inputs
and `1.txt`, `2.txt`, `3.txt` as outputs (in separate folders/pickers, since a
browser file picker can't hold two files with the same name at once) and they
pair up 1st-with-1st, 2nd-with-2nd, 3rd-with-3rd. Name them consistently and
sort order will do the right thing (numeric-aware: `2.txt` sorts before
`10.txt`).

**One test case per file (simple case):** just put the whole input in one
file and the matching output in another. This still works exactly as before.

**Multiple test cases in one file:** put more than one test case in a single
`.txt` file by separating them with a line containing **exactly**:

```
===TESTCASE===
```

on its own line, nothing else on that line. Example `input.txt` with 3 test
cases:

```
5 7
===TESTCASE===
100 200
===TESTCASE===
-3 3
```

and the matching `output.txt`:

```
12
===TESTCASE===
300
===TESTCASE===
0
```

Rules:
- The delimiter line must be **exactly** `===TESTCASE===` (no extra spaces,
  no markdown formatting) — surrounding whitespace on that line is trimmed,
  but the text itself must match exactly.
- A file with **zero** delimiter lines is treated as **one** test case (the
  whole file). A file with **N** delimiter lines is split into **N+1** test
  cases.
- The input file and its paired output file **must split into the same
  number of test cases**. If they don't match, that file pair is skipped
  (with an error toast naming the mismatched counts) and the rest still load.
- You can **mix**: e.g. one input file with 5 test cases (via the delimiter)
  paired with one output file with 5 test cases, *plus* a second pair of
  plain single-test-case files — all get appended together.
- Trailing blank lines at the end of each split chunk are trimmed
  automatically; you don't need to worry about a stray newline before/after
  a delimiter line.

Loaded test cases are appended to whatever's already in the form — review
them (and delete any you don't want) before saving the problem.

## 2. Bulk-importing contests/problems (JSON)

Two more places in the admin app accept a JSON file to create many things at
once, the same way the test case uploader above lets you skip typing each
one by hand:

- **Contests list page → "Bulk Import"** — creates one or more whole
  contests in one shot.
- **Contest detail page → "Bulk Add"** — adds one or more problems to that
  *existing* contest in one shot.

Every level of nesting is **optional** — a contest can be created with zero
problems, a problem with zero test cases. Add only as much as you have ready
and fill in the rest later through the normal editor.

**Bulk Import (contests) file shape** — a JSON array of contest objects, or
`{ "contests": [...] }`:

```json
[
  {
    "name": "Weekly Contest 1",
    "description": "Optional blurb",
    "startTime": "2026-09-05T10:00",
    "endTime": "2026-09-05T13:00",
    "problems": [
      {
        "title": "Two Sum",
        "description": "Given an array of integers...",
        "difficulty": "Easy",
        "category": "Arrays",
        "timeLimit": 1000,
        "memoryLimit": 256,
        "checker": "token",
        "points": 100,
        "sampleTestCases": [
          { "input": "5 7", "output": "12" }
        ],
        "hiddenTestCases": [
          { "input": "100 200", "output": "300" },
          { "input": "-3 3", "output": "0" }
        ]
      },
      {
        "title": "Problem With No Test Cases Yet",
        "description": "...",
        "difficulty": "Medium"
      }
    ]
  },
  {
    "name": "Weekly Contest 2 (no problems yet)",
    "startTime": "2026-09-12T10:00",
    "endTime": "2026-09-12T13:00"
  }
]
```

**Bulk Add (problems) file shape**, used on a contest's own page — a JSON
array of problem objects (same shape as the `problems` entries above), or
`{ "problems": [...] }`:

```json
[
  { "title": "Two Sum", "description": "...", "difficulty": "Easy", "sampleTestCases": [] },
  { "title": "Another One", "description": "...", "difficulty": "Hard" }
]
```

**Field rules:**
- Contest requires `name`, `startTime`, `endTime` (same as the single-contest
  form). `id` is optional — a random hex id is generated if omitted, same as
  the single-contest form does.
- A *new* problem (an `id` not already in the database) requires `title`,
  `description`, `difficulty` (`Easy`/`Medium`/`Hard`). `id` is optional — a
  random numeric id is generated if omitted, same as the single-problem
  form's own auto-generated default.
- If a problem `id` **already exists in the database**, it's reused as-is
  (attached to the contest by reference) — any other fields you put on that
  entry are ignored, exactly like adding an existing problem through the
  single-problem "Add Problem" panel.
- `sampleTestCases`/`hiddenTestCases` on a problem use the same
  `{ "input": ..., "output": ... }` pairs as the single-problem editor —
  omit either array (or leave it empty) for a problem with no test cases yet.
- `checker` decides how a student's output is compared against the expected
  output. Five options (also available as a dropdown in the problem editor,
  which explains each one):
  - `"token"` (default if omitted) - spaces, tabs and line breaks are all
    ignored; only the sequence of words/numbers matters. Right for almost
    every problem.
  - `"om"` - compared line by line: the number and order of lines must
    match, but spaces/tabs inside each line are ignored. Use when an answer
    has several meaningful lines but spacing is just formatting - e.g. a
    multiplication table, where `1x1=1` and `1 x 1 = 1` are the same answer.
  - `"exact"` - everything matches character for character, including
    leading spaces and blank lines; only trailing spaces, line endings and a
    trailing newline are forgiven. Use for pattern-printing problems where
    the shape is the answer.
  - `"numeric"` - like `token`, but floating-point values only need to agree
    to ~6 significant digits, so `3.14159` passes against `3.14159265`. Use
    for geometry/maths problems with real-number answers.
  - `"unordered"` - like `token`, but the order of the values is ignored;
    only how many of each value you printed matters. Use when the problem
    says "in any order".
  - `"custom"` - your own rule, built from the options in `checkerConfig`
    (see below). Use when none of the five fit.

  Any other value is rejected and that row is skipped with a reason, rather
  than silently guessing.
- **Every checker ignores trailing noise.** Whatever comes after the last
  non-space character of the output - a final `endl`, trailing spaces, blank
  lines at the end - is stripped from both sides before comparing, in all six
  modes. A student can't see any of it, so it can never be the reason a
  correct answer is marked wrong. Leading whitespace is *not* stripped this
  way: for `exact` it is part of the answer, and the other modes handle it as
  part of their own rule.
- **What a student is shown is their real output.** A checker's rules decide
  the verdict only. The "Your Output" / "Expected" panels always show each
  side exactly as the programs printed it - every space, tab, blank line and
  line break still in place (the sole exception being CRLF shown as LF, which
  is invisible on screen). So a student  reading a Wrong Answer sees the actual
  difference, not a tidied-up version of it.
- **A program that tries to use too much memory is stopped, and the machine is
  protected.** Every problem's `memoryLimit` and `timeLimit` are enforced. On top
  of that, a run is killed if it starts consuming the computer's remaining free
  memory, so a program with an accidental runaway loop (an unbounded
  `while (cin >> x) v.push_back(x);` is the usual one) can no longer fill the
  machine's RAM and freeze the whole laptop. The verdict is "Memory Limit
  Exceeded" either way.
- **One submission every 3 seconds per student.** A student cannot submit (or
  hit Run on the server) more than once every 3 seconds - pressing again sooner
  just says "wait N second(s)". Submitting and Running are counted separately,
  so testing with Run never locks you out of submitting. This exists so one
  student holding Enter cannot slow down the whole lab.
- **A batch of offline submissions is capped at 200 and synced at most once
  every 3 seconds.** A laptop that was offline still flushes its queue
  automatically; it just can't send an unbounded pile of work in one go.
- `checkerConfig` is only read when `checker` is `"custom"`, and every field
  is optional - anything unusable falls back to its default rather than
  failing the submission:
  ```json
  "checkerConfig": {
    "compareAs": "lines",
    "ignoreWhitespace": true,
    "ignoreBlankLines": true,
    "ignoreCase": false,
    "ignoreChars": ",",
    "numberTolerance": null
  }
  ```
  - `compareAs` - `"lines"` (line count and order matter, like `om`) or
    `"tokens"` (line breaks ignored, like `token`). Default `"lines"`.
  - `ignoreWhitespace` - delete every space/tab inside each line. Lines mode
    only. Default `true`.
  - `ignoreBlankLines` - drop blank lines. Lines mode only. Default `true`.
  - `ignoreCase` - `YES` equals `yes`. Default `false`.
  - `ignoreChars` - characters deleted from both sides before anything else,
    e.g. `","` to ignore thousands separators or `"()"` for bracketed
    answers. At most 64 characters. Default `""`.
  - `numberTolerance` - tokens mode only: compare number-like tokens to this
    relative tolerance instead of as text, e.g. `0.000001` for about six
    significant digits. `null` (the default) compares everything as exact
    text.
- `points` is how much an Accepted verdict on this problem is worth on the
  leaderboard. Omit it for `100` - problems don't have to be worth the same
  amount, so a harder problem can be set higher to outweigh easier ones.
- Recommended, not enforced: give every problem a real `description`, at
  least 2 `sampleTestCases`, and around 10 `hiddenTestCases`. Nothing
  rejects a thinner problem than that, but a problem judged on too few
  hidden cases is easy to accidentally pass with a wrong solution.

**Row-level skipping, not all-or-nothing:** a bad or duplicate entry is
skipped and reported, the rest of the file still imports. After you click
Import, each row shows a status badge:
- **created** — a brand-new contest/problem was made.
- **reused** — an existing problem id was found and attached as-is (contests
  only ever show `created`/`skipped`, never `reused`, since contest ids
  aren't meant to be shared across entries).
- **skipped** — with a reason, e.g. a contest `id` that's already taken, a
  problem `id` already attached to *that* contest, required fields missing
  on a brand-new problem, or a top-level required field missing on a
  contest. Fix that entry in the file and re-import just that row if needed
  — already-created rows are untouched by a re-run.

## 3. The Electron desktop app (student client)

Built from `apps/client-electron/`. The build produces one file,
`apps/client-electron/dist/Tharka Codex.exe` (NSIS installer, ~80MB):
double-click it and it installs to `%LOCALAPPDATA%\Programs\tharka-codex\`
(no admin rights needed, per-user install), adding Desktop, Start Menu,
Downloads and **taskbar-pinned** shortcuts. Copy that one file to each lab
laptop and run it there — that is the whole deployment step.

Current build: **version 2.0.2**. Only one copy of the app runs per laptop -
if it is already open, launching it again just brings the existing window to
the front instead of opening a second one. (2.0.2 is the build that makes the
memory limit actually work - on 2.0.1 and earlier it was silently not being
enforced, which is what let a runaway program freeze a laptop. Replace the
installer on every machine with this one.)

**Updating is manual.** The app no longer updates itself: there is no
in-app "Check for Updates", no admin "Publish Update" button, and no update
feed on the server. To roll out a new version, rebuild here and run the new
installer on each laptop (it installs over the existing copy). See
`CLAUDE.md` for why the auto-updater was removed.

The app works even if the contest server isn't running — it renders its own
UI locally either way, and just shows stale/cached contest data (or none, on
a laptop that's never synced) until it can reach the server. It does **not**
need the server up to start or to display something.

By default it points at `http://192.168.1.101:3001` — that's baked into
`apps/client-electron/main.js`'s `DEFAULT_SERVER_URL` (and mirrored in
`apps/client-web/src/lib/apiClient.ts`'s `DEFAULT_SERVER_URL` for the
plain-browser build). Update both and rebuild if the server's LAN IP ever changes.

**Rebuilding after a code change** (from `TharkaContestPlatform/`):
```
cd apps/client-web && npx vite build && cd ../client-electron && npm run build
```
(`npm run build` also runs the judge-cpp drift check first. Add
`-- --win nsis portable` if you also want a self-contained portable exe
alongside the installer.)

## 4. Running the server + admin app locally (dev)

```
cd TharkaContestPlatform
node apps/server/server.js          # port 3001, needs local MongoDB running
cd apps/admin-web && npx vite       # port 5174 - open this in a browser to manage contests
cd apps/client-web && npx vite      # port 5173 - plain-browser version of the student client
```

Open `http://localhost:5174` for the admin app (create/edit contests and
problems, trigger sync, view live results).

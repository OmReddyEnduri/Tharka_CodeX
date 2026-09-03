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

Built from `apps/client-electron/`. Two files come out of the build, both in
`apps/client-electron/dist/`:

- **`Tharka Codex 1.0.0.exe`** (portable, ~76MB) — a single,
  self-contained file. Copy it anywhere (a USB stick, a fresh folder, a lab
  laptop's desktop) and double-click it directly — it self-extracts to a
  temp folder and runs from there. **Does not need any sibling files or
  folders next to it.** This is the one to hand out for quick testing or
  ad-hoc use on a laptop.
- **`Tharka Codex Setup 1.0.0.exe`** (NSIS installer, ~77MB) — a
  proper installer: double-click, it installs to
  `%LOCALAPPDATA%\Programs\Tharka Codex\` (no admin rights needed,
  per-user install) and adds a Start Menu entry. Use this for a real,
  repeated lab deployment instead of the portable one.

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
cd apps/client-web && npx vite build && cd ../client-electron && npx electron-builder --win nsis portable
```

## 4. Running the server + admin app locally (dev)

```
cd TharkaContestPlatform
node apps/server/server.js          # port 3001, needs local MongoDB running
cd apps/admin-web && npx vite       # port 5174 - open this in a browser to manage contests
cd apps/client-web && npx vite      # port 5173 - plain-browser version of the student client
```

Open `http://localhost:5174` for the admin app (create/edit contests and
problems, trigger sync, view live results).

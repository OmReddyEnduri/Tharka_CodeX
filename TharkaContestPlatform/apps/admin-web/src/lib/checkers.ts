// The admin-facing description of every output checker.
//
// This list is deliberately duplicated from packages/judge-cpp/checkers.js
// rather than imported: judge-cpp is a Node module (fs/os/path) and this is a
// browser bundle, so it can't be pulled in. The real rules live there; this is
// only the dropdown's labels/help text plus the value set the server
// validates against, so nothing here can disagree with judging about the
// *ids* - the server rejects any value judge-cpp's own CHECKER_IDS doesn't
// contain, which is what keeps these two honest.
export const CHECKERS = [
  {
    id: "token",
    label: "Token (whitespace-insensitive)",
    hint: "Spaces, tabs and line breaks are all ignored - only the sequence of words/numbers matters. The right default for almost every problem.",
  },
  {
    id: "om",
    label: "Line by line, ignore spaces",
    hint: "Compares line by line: the number and order of lines must match, but spaces/tabs inside each line are ignored. Use when an answer has several meaningful lines (e.g. a multiplication table) but spacing is just formatting.",
  },
  {
    id: "exact",
    label: "Exact (spacing-sensitive)",
    hint: "Everything must match character for character, including leading spaces and blank lines - only trailing spaces, line endings and a trailing newline are forgiven. Use for pattern-printing problems where the shape is the answer.",
  },
  {
    id: "numeric",
    label: "Numeric (tolerance on floats)",
    hint: "Like Token, but floating-point answers only need to match to ~6 significant digits, so 3.14159 passes against 3.14159265. Use for geometry/maths problems with real-number answers.",
  },
  {
    id: "unordered",
    label: "Token, any order",
    hint: "Like Token, but the order of the values is ignored - only how many of each value you printed matters. Use when the problem says \"in any order\".",
  },
  {
    id: "custom",
    label: "Custom (your own rules)",
    hint: "Build your own rule from the options: compare line by line or as tokens, ignore spaces/case/blank lines, delete specific characters (e.g. commas), and optionally compare numbers with a tolerance. Use when none of the standard five fit.",
  },
  {
    id: "code",
    label: "Code (your own C++ checker)",
    hint: "Write a C++ function  bool checker(string expected, string user)  that returns true when the student's output is correct. Runs the same on the server and on every lab laptop. Use when an answer has many valid forms (any order, any valid path, \"print any solution\", your own tolerance).",
  },
] as const;

// Starting point for a new "code" checker - mirrors CHECKER_CODE_TEMPLATE in
// packages/judge-cpp/codeChecker.js.
export const CHECKER_CODE_TEMPLATE = `// Return true if the student's output is correct.
//   expected = this test case's expected output
//   user     = what the student's program printed
// Both use '\\n' line endings, with trailing spaces/newlines at the end removed.
bool checker(string expected, string user) {
    return expected == user;
}
`;

export type CheckerId = (typeof CHECKERS)[number]["id"];

// Typed as a non-empty tuple so it drops straight into z.enum() below and
// into the server-side validation message.
export const CHECKER_IDS = CHECKERS.map((c) => c.id) as unknown as [CheckerId, ...CheckerId[]];

export const DEFAULT_CHECKER: CheckerId = "token";

// Narrowing helper for data that predates the field, or that came back from a
// table of all-strings in a fetched document: anything unrecognized reads as
// the default, exactly like judge-cpp's own getChecker() does, so the editor
// shows the checker the problem is actually being graded with.
export function asCheckerId(value: unknown): CheckerId {
  return CHECKER_IDS.includes(value as CheckerId) ? (value as CheckerId) : DEFAULT_CHECKER;
}

// --- the "custom" checker's options ---------------------------------------
//
// Mirrors CUSTOM_DEFAULTS in packages/judge-cpp/checkers.js. That module is the
// authority - it sanitizes whatever arrives, so a value this form sends can
// never make judging fail; these are just the same defaults, so the editor
// opens showing what the problem is actually being graded with.
export interface CheckerConfig {
  compareAs: "lines" | "tokens";
  ignoreWhitespace: boolean;
  ignoreBlankLines: boolean;
  ignoreCase: boolean;
  ignoreChars: string;
  numberTolerance: number | null;
}

export const CUSTOM_DEFAULTS: CheckerConfig = {
  compareAs: "lines",
  ignoreWhitespace: true,
  ignoreBlankLines: true,
  ignoreCase: false,
  ignoreChars: "",
  numberTolerance: null,
};

// Same coercion rule as the judge's own normalizeCheckerConfig: anything
// missing or unusable becomes that field's default rather than an error.
export function asCheckerConfig(value: unknown): CheckerConfig {
  const src = (value && typeof value === "object" ? value : {}) as Partial<CheckerConfig>;
  const tolerance = Number(src.numberTolerance);
  return {
    compareAs: src.compareAs === "tokens" ? "tokens" : "lines",
    ignoreWhitespace: typeof src.ignoreWhitespace === "boolean" ? src.ignoreWhitespace : CUSTOM_DEFAULTS.ignoreWhitespace,
    ignoreBlankLines: typeof src.ignoreBlankLines === "boolean" ? src.ignoreBlankLines : CUSTOM_DEFAULTS.ignoreBlankLines,
    ignoreCase: typeof src.ignoreCase === "boolean" ? src.ignoreCase : CUSTOM_DEFAULTS.ignoreCase,
    ignoreChars: typeof src.ignoreChars === "string" ? src.ignoreChars : CUSTOM_DEFAULTS.ignoreChars,
    numberTolerance: Number.isFinite(tolerance) && tolerance > 0 ? tolerance : null,
  };
}

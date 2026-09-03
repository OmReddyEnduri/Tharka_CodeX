import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { toast } from "sonner";

interface TestCaseFileUploadProps {
  onLoaded: (pairs: { input: string; output: string }[]) => void;
}

// Full format rules are documented in HOWTOUSE.md at the repo root - keep
// that file in sync with this constant/logic if either changes.
export const TESTCASE_DELIMITER = "===TESTCASE===";

// Naming convention: pair input/output files by sorted filename order (not
// fuzzy name-matching) - name them consistently across the two pickers, e.g.
// 1.txt/2.txt/3.txt in both, or input1.txt<->output1.txt (both sort the same
// way). Numeric-aware sort so "2.txt" sorts before "10.txt".
function naturalSort(files: File[]): File[] {
  return [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
}

// A file with no delimiter is treated as exactly one test case (unchanged
// from the original one-file-per-testcase behavior). A file containing one
// or more `===TESTCASE===` lines is split into that many test cases, in
// order. This lets a single .txt hold many test cases, or many .txt files
// each hold one (or a mix) - whichever is more convenient to prepare.
function splitTestCases(content: string): string[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const chunks: string[][] = [[]];
  for (const line of lines) {
    if (line.trim() === TESTCASE_DELIMITER) {
      chunks.push([]);
    } else {
      chunks[chunks.length - 1].push(line);
    }
  }
  return chunks.map((c) => c.join("\n").replace(/\n+$/, ""));
}

export function TestCaseFileUpload({ onLoaded }: TestCaseFileUploadProps) {
  const [inputFiles, setInputFiles] = useState<File[]>([]);
  const [outputFiles, setOutputFiles] = useState<File[]>([]);

  const handleLoad = async () => {
    if (inputFiles.length === 0 || outputFiles.length === 0) {
      toast.error("Select both input and output files first");
      return;
    }
    const ins = naturalSort(inputFiles);
    const outs = naturalSort(outputFiles);
    const count = Math.min(ins.length, outs.length);
    if (ins.length !== outs.length) {
      toast.warning(`${ins.length} input file(s) but ${outs.length} output file(s) — pairing only the first ${count}`);
    }

    const pairs: { input: string; output: string }[] = [];
    for (let i = 0; i < count; i++) {
      const [inputText, outputText] = await Promise.all([ins[i].text(), outs[i].text()]);
      const inputCases = splitTestCases(inputText);
      const outputCases = splitTestCases(outputText);

      if (inputCases.length !== outputCases.length) {
        toast.error(
          `${ins[i].name} has ${inputCases.length} test case(s) but ${outs[i].name} has ${outputCases.length} — skipping this pair. Make sure both files use the same number of "${TESTCASE_DELIMITER}" separators.`
        );
        continue;
      }

      for (let j = 0; j < inputCases.length; j++) {
        pairs.push({ input: inputCases[j], output: outputCases[j] });
      }
    }

    onLoaded(pairs);
    toast.success(`Loaded ${pairs.length} test case(s) from files`);
    setInputFiles([]);
    setOutputFiles([]);
  };

  return (
    <div className="flex flex-wrap items-end gap-3 p-3 border border-dashed rounded-md bg-muted/20">
      <div className="space-y-1">
        <label className="text-[10px] uppercase font-semibold text-muted-foreground block">Input files (.txt)</label>
        <input
          type="file"
          multiple
          accept=".txt"
          onChange={(e) => setInputFiles(Array.from(e.target.files || []))}
          className="text-xs block max-w-[220px]"
        />
      </div>
      <div className="space-y-1">
        <label className="text-[10px] uppercase font-semibold text-muted-foreground block">Output files (.txt)</label>
        <input
          type="file"
          multiple
          accept=".txt"
          onChange={(e) => setOutputFiles(Array.from(e.target.files || []))}
          className="text-xs block max-w-[220px]"
        />
      </div>
      <Button type="button" size="sm" variant="secondary" onClick={handleLoad}>
        <Upload className="h-3 w-3 mr-1" /> Load Pairs
      </Button>
      <p className="w-full text-[10px] text-muted-foreground">
        Files are paired by sorted filename order (e.g. 1.txt with 1.txt). Each file can hold one test case, or
        several separated by a line containing exactly <code className="font-mono">{TESTCASE_DELIMITER}</code> —
        full rules in HOWTOUSE.md. Loaded pairs are appended below.
      </p>
    </div>
  );
}

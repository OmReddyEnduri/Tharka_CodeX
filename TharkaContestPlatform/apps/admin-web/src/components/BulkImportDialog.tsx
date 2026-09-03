import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/apiClient";
import type { BulkContestInput, BulkContestResult, BulkProblemInput, BulkProblemResult } from "@/lib/types";

// Full JSON format (both modes) documented in HOWTOUSE.md at the repo root -
// keep that file in sync with this component's parsing/validation if either
// changes.

const statusClass: Record<string, string> = {
  created: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  reused: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  skipped: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
};

function StatusBadge({ status }: { status: string }) {
  return <Badge className={statusClass[status] || ""}>{status}</Badge>;
}

interface BulkImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "contests" | "problems";
  contestId?: string;
}

export function BulkImportDialog({ isOpen, onClose, mode, contestId }: BulkImportDialogProps) {
  const queryClient = useQueryClient();
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<BulkContestInput[] | BulkProblemInput[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [contestResults, setContestResults] = useState<BulkContestResult[] | null>(null);
  const [problemResults, setProblemResults] = useState<BulkProblemResult[] | null>(null);

  const reset = () => {
    setFileName(null);
    setParsed(null);
    setParseError(null);
    setContestResults(null);
    setProblemResults(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = async (file: File) => {
    reset();
    setFileName(file.name);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      // Accept either a bare array, or { contests: [...] } / { problems: [...] }
      // so a file exported from either mode's schema still loads.
      const list = Array.isArray(json) ? json : json[mode];
      if (!Array.isArray(list)) {
        setParseError(
          mode === "contests"
            ? 'Expected a JSON array of contests, or { "contests": [...] }'
            : 'Expected a JSON array of problems, or { "problems": [...] }'
        );
        return;
      }
      setParsed(list);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Could not parse this file as JSON");
    }
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      if (mode === "contests") {
        return apiClient.bulkCreateContests(parsed as BulkContestInput[]);
      }
      return apiClient.bulkAddProblems(contestId!, parsed as BulkProblemInput[]);
    },
    onSuccess: (data) => {
      if (mode === "contests") {
        setContestResults(data.results as BulkContestResult[]);
        queryClient.invalidateQueries({ queryKey: ["contests"] });
      } else {
        setProblemResults(data.results as BulkProblemResult[]);
        queryClient.invalidateQueries({ queryKey: ["contest", contestId] });
      }
      const created = data.results.filter((r: any) => r.status === "created").length;
      const skipped = data.results.filter((r: any) => r.status === "skipped").length;
      toast.success(`Import done — ${created} created, ${skipped} skipped`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "contests" ? "Bulk Import Contests" : "Bulk Add Problems"}</DialogTitle>
          <DialogDescription>
            {mode === "contests"
              ? "Upload a JSON file describing one or more contests. Each contest can optionally include its own problems, and each problem can optionally include its own sample/hidden test cases — every level is optional."
              : "Upload a JSON file describing one or more problems to add to this contest. Each problem can optionally include its own sample/hidden test cases."}
            {" "}Full format in HOWTOUSE.md.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 border border-dashed rounded-md bg-muted/20">
            <input
              type="file"
              accept=".json"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              className="text-xs"
            />
            {fileName && <span className="text-xs text-muted-foreground">{fileName}</span>}
          </div>

          {parseError && <p className="text-sm text-red-500">{parseError}</p>}

          {parsed && !parseError && (
            <p className="text-sm text-muted-foreground">
              Loaded {parsed.length} {mode === "contests" ? "contest(s)" : "problem(s)"} from the file. Review the
              format in HOWTOUSE.md if this doesn't look right, then click Import.
            </p>
          )}

          {contestResults && (
            <div className="space-y-3">
              {contestResults.map((c, i) => (
                <div key={i} className="p-3 border rounded-md space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm">{c.name || c.id}</span>
                    <StatusBadge status={c.status} />
                  </div>
                  {c.reason && <p className="text-xs text-muted-foreground">{c.reason}</p>}
                  {c.problems && c.problems.length > 0 && (
                    <div className="pl-3 border-l space-y-1">
                      {c.problems.map((p, j) => (
                        <div key={j} className="flex items-center justify-between gap-2 text-xs">
                          <span>
                            {p.title || p.id} <span className="text-muted-foreground">#{p.id}</span>
                          </span>
                          <div className="flex items-center gap-2">
                            {p.reason && <span className="text-muted-foreground">{p.reason}</span>}
                            <StatusBadge status={p.status} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {problemResults && (
            <div className="space-y-2">
              {problemResults.map((p, i) => (
                <div key={i} className="flex items-center justify-between gap-2 p-2 border rounded-md text-sm">
                  <span>
                    {p.title || p.id} <span className="text-muted-foreground text-xs">#{p.id}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    {p.reason && <span className="text-xs text-muted-foreground">{p.reason}</span>}
                    <StatusBadge status={p.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {contestResults || problemResults ? "Close" : "Cancel"}
          </Button>
          {!contestResults && !problemResults && (
            <Button onClick={() => importMutation.mutate()} disabled={!parsed || importMutation.isPending} className="gap-2">
              {importMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Import
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

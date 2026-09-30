import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/apiClient";

// Admin picks one built installer exe and clicks Publish - the server
// computes its checksum and stamps the version from the current moment
// itself (appUpdateRoutes.js's publishTimeVersion()), so there's nothing
// else to upload alongside it. "Is there an update" means "was something
// newer PUBLISHED", not "was something built with a later timestamp" - an
// admin might build several times while testing and only publish one of
// them, so the publish moment (not the build's own baked-in
// stamp-version.js timestamp) is what electron-updater actually compares
// against.
//
// Doesn't auto-notify connected laptops: client-electron dropped every
// automatic update trigger in favor of a manual "Check for Updates" button
// in its own Settings - so publishing here only makes the build available
// to check against, not an "instant rollout."
export function PushUpdateCard() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: current } = useQuery({
    queryKey: ["app-update-current"],
    queryFn: apiClient.getCurrentAppUpdate,
  });

  const publishMutation = useMutation({
    mutationFn: () => apiClient.publishAppUpdate(file as File),
    onSuccess: (data) => {
      toast.success(`Published v${data.version} - laptops will see it next time someone clicks "Check for Updates"`);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      queryClient.invalidateQueries({ queryKey: ["app-update-current"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const canPush = !!file && !publishMutation.isPending;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
      <div className="text-sm text-muted-foreground">
        {current ? (
          <>
            Currently published: <span className="font-medium text-foreground">v{current.version}</span>
          </>
        ) : (
          "No app build published yet"
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".exe"
        title="Tharka Codex.exe from dist/"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="text-sm text-muted-foreground file:mr-2 file:h-8 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:text-sm file:font-medium"
      />
      <Button
        size="sm"
        onClick={() => publishMutation.mutate()}
        disabled={!canPush}
        className="ml-auto gap-2"
        title="Publish this build - laptops pick it up when someone clicks Check for Updates"
      >
        <UploadCloud className={`h-3.5 w-3.5 ${publishMutation.isPending ? "animate-pulse" : ""}`} />
        {publishMutation.isPending ? "Publishing..." : "Publish Update"}
      </Button>
    </div>
  );
}

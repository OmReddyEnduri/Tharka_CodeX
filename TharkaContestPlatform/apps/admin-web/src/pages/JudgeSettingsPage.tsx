import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/lib/apiClient";

interface FormData {
  compileTimeoutSec: number;
  maxOutputKb: number;
  interactiveSessionMaxSec: number;
  blockedKeywords: string;
}

export default function JudgeSettingsPage() {
  const queryClient = useQueryClient();
  const form = useForm<FormData>();

  const { data, isLoading } = useQuery({
    queryKey: ["judge-settings"],
    queryFn: () => apiClient.getJudgeSettings(),
    // React Query's default refetchOnWindowFocus would otherwise refetch
    // (and hand the effect below a new object reference, even when nothing
    // actually changed server-side) the moment the admin alt-tabs and comes
    // back mid-edit - silently wiping whatever they'd typed with the
    // server's last-saved values, no error shown. This data only ever
    // changes via this page's own save (which updates the cache directly in
    // saveMutation's onSuccess below), so there's nothing else to refetch
    // for.
    staleTime: Infinity,
  });

  useEffect(() => {
    if (data) {
      form.reset({
        compileTimeoutSec: data.compileTimeoutMs / 1000,
        maxOutputKb: Math.round(data.maxOutputBytes / 1024),
        interactiveSessionMaxSec: data.interactiveSessionMaxMs / 1000,
        blockedKeywords: data.blockedKeywords.join(", "),
      });
    }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveMutation = useMutation({
    mutationFn: (values: FormData) =>
      apiClient.updateJudgeSettings({
        compileTimeoutMs: Math.round(values.compileTimeoutSec * 1000),
        maxOutputBytes: Math.round(values.maxOutputKb * 1024),
        interactiveSessionMaxMs: Math.round(values.interactiveSessionMaxSec * 1000),
        blockedKeywords: values.blockedKeywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
      }),
    onSuccess: (settings) => {
      queryClient.setQueryData(["judge-settings"], settings);
      toast.success("Judge settings saved - every lab PC picks this up on its next sync.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleResetKeywords = () => {
    if (!data?.defaultBlockedKeywords) return;
    form.setValue("blockedKeywords", data.defaultBlockedKeywords.join(", "));
  };

  if (isLoading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Judge Settings</CardTitle>
        <CardDescription>
          Platform-wide judge engine config - applies to every contest, on the server and on every Electron
          laptop's local judge (reaches each laptop on its next sync, no code change needed).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={form.handleSubmit((values) => {
            const keywordCount = values.blockedKeywords
              .split(",")
              .map((k) => k.trim())
              .filter(Boolean).length;
            const defaultCount = data?.defaultBlockedKeywords?.length ?? 0;
            // One accidental select-all-delete in that textarea used to
            // disable the entire static-check defense for every contest
            // platform-wide, instantly, with only a generic "saved" toast -
            // no warning that anything unusual just happened.
            if (keywordCount === 0 || (defaultCount > 0 && keywordCount < defaultCount / 2)) {
              const proceed = window.confirm(
                keywordCount === 0
                  ? "The blocked-keywords list is empty. This disables the entire static-check defense for every contest, immediately. Save anyway?"
                  : `Only ${keywordCount} keyword(s) left (the default list has ${defaultCount}). This weakens the static-check defense for every contest, immediately. Save anyway?`
              );
              if (!proceed) return;
            }
            saveMutation.mutate(values);
          })}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="blockedKeywords">Blocked keywords</Label>
            <Textarea
              id="blockedKeywords"
              rows={3}
              {...form.register("blockedKeywords")}
              placeholder="rm, mv, chmod, system, fork, exec, ..."
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated. A submission is rejected before it's even compiled if it contains any of these as a
              whole word (e.g. "system" blocks `system(...)` but not "ecosystem"). If a student's legitimate code
              (e.g. a function literally named <code>remove</code>) keeps getting rejected, remove that word here.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={handleResetKeywords}>
              Reset to defaults
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="compileTimeoutSec">Compile timeout (sec)</Label>
              <Input
                id="compileTimeoutSec"
                type="number"
                step="1"
                min="1"
                {...form.register("compileTimeoutSec", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxOutputKb">Max output (KB)</Label>
              <Input
                id="maxOutputKb"
                type="number"
                step="1"
                min="1"
                {...form.register("maxOutputKb", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="interactiveSessionMaxSec">Compiler console max session (sec)</Label>
              <Input
                id="interactiveSessionMaxSec"
                type="number"
                step="1"
                min="1"
                {...form.register("interactiveSessionMaxSec", { valueAsNumber: true })}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Compile timeout and max output apply to every judged run (Run, Submit, and the standalone Compiler
            page). The session cap only applies to the Compiler page's live interactive Console tab.
          </p>

          <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Saving..." : "Save Judge Settings"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

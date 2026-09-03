import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setIdentity } from "@/lib/identity";

const joinSchema = z.object({
  name: z.string().min(2, "Name is required"),
  rollNumber: z.string().min(1, "Roll number is required"),
});

type JoinFormData = z.infer<typeof joinSchema>;

export default function JoinContest() {
  const { contestId } = useParams<{ contestId: string }>();
  const navigate = useNavigate();

  const form = useForm<JoinFormData>({ resolver: zodResolver(joinSchema) });

  const onSubmit = (data: JoinFormData) => {
    if (!contestId) return;
    setIdentity(contestId, data);
    navigate(`/contest/${contestId}`);
  };

  return (
    <AppShell>
      <div className="container mx-auto max-w-md py-12 px-4">
        <Card>
          <CardHeader>
            <CardTitle>Join Contest</CardTitle>
            <CardDescription>Enter your name and roll number to continue.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" {...form.register("name")} />
                {form.formState.errors.name && (
                  <p className="text-destructive text-sm">{form.formState.errors.name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="rollNumber">Roll Number</Label>
                <Input id="rollNumber" {...form.register("rollNumber")} />
                {form.formState.errors.rollNumber && (
                  <p className="text-destructive text-sm">{form.formState.errors.rollNumber.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full">
                Continue
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

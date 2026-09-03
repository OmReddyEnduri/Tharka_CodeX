import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@clerk/clerk-react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const contestSchema = z.object({
  name: z.string().min(2, "Name is required"),
  description: z.string().optional(),
  startTime: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid start time"),
  endTime: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid end time"),
});

type ContestFormData = z.infer<typeof contestSchema>;

const CreateContest = () => {
    const { courseId } = useParams<{ courseId: string }>();
    const navigate = useNavigate();
    const { getToken } = useAuth();
    const { toast } = useToast();
    const API_URL = `${import.meta.env.VITE_API_URL}/api`;

    const form = useForm<ContestFormData>({
        resolver: zodResolver(contestSchema),
    });

    const createContestMutation = useMutation({
        mutationFn: async (data: ContestFormData) => {
            const token = await getToken();
            const payload = { ...data, courseId };
            const res = await fetch(`${API_URL}/contests`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.msg || "Failed to create contest");
            }
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Success", description: "Contest created successfully" });
            navigate(`/admin/courses/${courseId}/contests`);
        },
        onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
    });

    const onSubmit = (data: ContestFormData) => {
        createContestMutation.mutate(data);
    };

    return (
        <Layout>
            <div className="container mx-auto py-8 px-4">
                <Card className="max-w-2xl mx-auto">
                    <CardHeader>
                        <CardTitle>Create New Contest</CardTitle>
                        <CardDescription>Fill out the details for the new contest.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Contest Name</Label>
                                <Input id="name" {...form.register("name")} />
                                {form.formState.errors.name && <p className="text-red-500 text-sm">{form.formState.errors.name.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="description">Description</Label>
                                <Textarea id="description" {...form.register("description")} />
                            </div>
                             <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="startTime">Start Time</Label>
                                    <Input id="startTime" type="datetime-local" {...form.register("startTime")} />
                                     {form.formState.errors.startTime && <p className="text-red-500 text-sm">{form.formState.errors.startTime.message}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="endTime">End Time</Label>
                                    <Input id="endTime" type="datetime-local" {...form.register("endTime")} />
                                    {form.formState.errors.endTime && <p className="text-red-500 text-sm">{form.formState.errors.endTime.message}</p>}
                                </div>
                            </div>
                            <Button type="submit" className="w-full" disabled={createContestMutation.isPending}>
                                {createContestMutation.isPending ? "Creating..." : "Create Contest"}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </Layout>
    );
};

export default CreateContest;

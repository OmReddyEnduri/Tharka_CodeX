import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrophyIcon, FileCode } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const Contest = () => {
    const { contestId } = useParams<{ contestId: string }>();
    const { getToken } = useAuth();

    const { data: contest, isLoading, isError, error } = useQuery<any>({
        queryKey: ["contest", contestId],
        queryFn: async () => {
            const token = await getToken();
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/contests/${contestId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Failed to fetch contest details");
            return res.json();
        },
        enabled: !!contestId,
    });

    if (isLoading) {
        return <Layout><div className="container p-8">Loading contest...</div></Layout>;
    }

    if (isError) {
        return <Layout><div className="container p-8">Error: {(error as Error).message}</div></Layout>;
    }

    return (
        <Layout>
            <div className="container mx-auto py-8 px-4">
                <div className="flex items-center gap-4 mb-4">
                    <TrophyIcon className="w-8 h-8 text-primary" />
                    <div>
                        <h1 className="text-3xl font-bold">{contest.name}</h1>
                        <p className="text-muted-foreground">{contest.description}</p>
                    </div>
                </div>
                
                <div className="mb-8">
                    {/* Add contest timer or other details here */}
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Problems</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {contest.problems && contest.problems.length > 0 ? (
                                contest.problems.map((problem: any) => (
                                    <div key={problem._id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                                        <div className="flex items-center gap-3">
                                            <FileCode className="h-5 w-5 text-blue-500" />
                                            <span className="font-semibold">{problem.title}</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <Badge className={cn("text-xs", 
                                                problem.difficulty === 'Easy' ? "bg-green-100 text-green-700" : 
                                                problem.difficulty === 'Medium' ? "bg-yellow-100 text-yellow-700" : 
                                                "bg-red-100 text-red-700"
                                            )}>
                                                {problem.difficulty}
                                            </Badge>
                                            <Button asChild>
                                                <Link to={`/contest/${contestId}/problem/${problem.id}`}>
                                                    Solve Problem
                                                </Link>
                                            </Button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-muted-foreground text-center py-4">No problems in this contest yet.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </Layout>
    );
};

export default Contest;

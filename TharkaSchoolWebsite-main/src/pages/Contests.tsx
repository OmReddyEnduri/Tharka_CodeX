import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-react";
import { format } from "date-fns";
import { Layout } from "@/components/layout/Layout";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarIcon, ClockIcon, TrophyIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Contest {
  _id: string;
  name: string;
  courseId: string;
  description?: string;
  startTime: string;
  endTime: string;
  problemIds: number[];
}

const Contests = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const { getToken } = useAuth();

  const { data: contests, isLoading: contestsLoading, isError: contestsError, error: contestsErrorData } = useQuery<Contest[]>({
    queryKey: ["courseContests", courseId],
    queryFn: async () => {
      if (!courseId) throw new Error("Course ID is required.");
      const token = await getToken();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/contests/courses/${courseId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.msg || "Failed to fetch contests.");
      }
      return res.json();
    },
    enabled: !!courseId,
  });

  const { data: course, isLoading: courseLoading, isError: courseError, error: courseErrorData } = useQuery<any>({
    queryKey: ["course", courseId],
    queryFn: async () => {
      if (!courseId) throw new Error("Course ID is required.");
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/courses/${courseId}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.msg || "Failed to fetch course details.");
      }
      return res.json();
    },
    enabled: !!courseId,
  });

  console.log("Course ID:", courseId);
  console.log("Fetched Contests:", contests);
  console.log("Fetched Course:", course);



  if (contestsLoading || courseLoading) {
    return (
      <Layout>
        <div className="container mx-auto py-8">
          <h1 className="text-3xl font-bold mb-6">Contests</h1>
          <p>Loading contests...</p>
        </div>
      </Layout>
    );
  }

  if (contestsError || courseError) {
    return (
      <Layout>
        <div className="container mx-auto py-8">
          <h1 className="text-3xl font-bold mb-6">Contests</h1>
          <p className="text-red-500">Error: {(contestsErrorData || courseErrorData)?.message}</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center gap-4 mb-8">
            <TrophyIcon className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">Contests for Course: {course?.name || courseId}</h1>
        </div>

        {contests && contests.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {contests.map((contest) => {
              const now = new Date();
              const startTime = new Date(contest.startTime);
              const endTime = new Date(contest.endTime);
              let status: "upcoming" | "active" | "ended";
              let statusText: string;
              let statusVariant: "default" | "secondary" | "destructive" | "outline" | "success";

              if (now < startTime) {
                status = "upcoming";
                statusText = "Upcoming";
                statusVariant = "secondary";
              } else if (now >= startTime && now <= endTime) {
                status = "active";
                statusText = "Active";
                statusVariant = "success";
              } else {
                status = "ended";
                statusText = "Ended";
                statusVariant = "outline";
              }

              return (
                <Card key={contest._id} className="flex flex-col">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                        <CardTitle className="text-xl">{contest.name}</CardTitle>
                        <Badge variant={statusVariant}>{statusText}</Badge>
                    </div>
                    <CardDescription>{contest.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col justify-between">
                    <div className="space-y-2 text-sm text-muted-foreground mb-4">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4" />
                        <span>
                          {format(startTime, "PPP")} - {format(endTime, "PPP")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ClockIcon className="w-4 h-4" />
                        <span>
                          {format(startTime, "p")} - {format(endTime, "p")}
                        </span>
                      </div>
                    </div>
                    {status !== "upcoming" && (
                        <Button asChild className="w-full mt-auto">
                            <Link to={`/contest/${contest._id}`}>View Contest</Link>
                        </Button>
                    )}
                    {status === "upcoming" && (
                        <Button disabled className="w-full mt-auto">
                            Contest Starts Soon
                        </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <p className="text-muted-foreground">No contests found for this course yet.</p>
        )}
      </div>
    </Layout>
  );
};

export default Contests;

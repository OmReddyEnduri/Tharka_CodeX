import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@clerk/clerk-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Plus, Trash2, Pencil } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ContestProblemEditorSheet } from "@/components/admin/ContestProblemEditorSheet";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";


const CourseContests = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const { getToken } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const API_URL = `${import.meta.env.VITE_API_URL}/api`;

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedContestId, setSelectedContestId] = useState<string | null>(null);
  const [editingProblem, setEditingProblem] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: contests, isLoading: contestsLoading, error } = useQuery({
    queryKey: ["courseContestsFull", courseId],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch(`${API_URL}/contests/courses/${courseId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error("Failed to fetch contests");
      }
      return res.json();
    },
    enabled: !!courseId,
  });

  const deleteContestMutation = useMutation({
    mutationFn: async (contestId: string) => {
      const token = await getToken();
      const res = await fetch(`${API_URL}/contests/${contestId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error("Failed to delete contest");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courseContestsFull", courseId] });
      toast({ title: "Success", description: "Contest deleted successfully" });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteProblemMutation = useMutation({
    mutationFn: async ({ contestId, problemId }: { contestId: string, problemId: number }) => {
      const token = await getToken();
      const res = await fetch(`${API_URL}/contests/${contestId}/problems/${problemId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error("Failed to delete problem");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courseContestsFull", courseId] });
      toast({ title: "Success", description: "Problem deleted successfully" });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleAddProblemClick = (contestId: string) => {
    setSelectedContestId(contestId);
    setEditingProblem(null);
    setIsSheetOpen(true);
  };

  const handleEditProblemClick = (problem: any, contestId: string) => {
    setSelectedContestId(contestId);
    setEditingProblem(problem);
    setIsSheetOpen(true);
  };

  const now = new Date();

  const filteredContests = contests?.filter((contest: any) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      contest.name.toLowerCase().includes(query) ||
      (contest.description && contest.description.toLowerCase().includes(query))
    );
  });

  const activeUpcomingContests = filteredContests
    ?.filter((contest: any) => new Date(contest.endTime) >= now)
    .sort((a: any, b: any) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const pastContests = filteredContests
    ?.filter((contest: any) => new Date(contest.endTime) < now)
    .sort((a: any, b: any) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime());

  const renderContest = (contest: any) => (
    <Card key={contest._id}>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>{contest.name}</CardTitle>
            <CardDescription>{contest.description}</CardDescription>
          </div>
          <div className="flex items-center">
            <Button variant="ghost" size="icon" className="text-blue-500 hover:bg-blue-50" onClick={() => navigate(`/admin/courses/${courseId}/contests/${contest._id}/edit`)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-50">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Contest?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete "{contest.name}" and all of its problems and submissions.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteContestMutation.mutate(contest._id)} className="bg-red-600 hover:bg-red-700">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <h4 className="font-semibold mb-3">Problems</h4>
        <div className="space-y-2 mb-4">
          {contest.problems && contest.problems.length > 0 ? (
            contest.problems.map((problem: any) => (
              <div key={problem._id} className="flex items-center justify-between p-2.5 rounded-md bg-white/50 hover:bg-white border">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{problem.title}</span>
                  <Badge className={cn("text-[10px] h-4 px-1 shadow-none",
                    problem.difficulty === 'Easy' ? "bg-green-100 text-green-700" :
                    problem.difficulty === 'Medium' ? "bg-yellow-100 text-yellow-700" :
                    "bg-red-100 text-red-700"
                  )}>
                    {problem.difficulty}
                  </Badge>
                </div>
                <div className="flex items-center">
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-blue-500" onClick={() => handleEditProblemClick(problem, contest._id)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-red-500">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Problem?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove "{problem.title}" from this contest.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteProblemMutation.mutate({ contestId: contest._id, problemId: problem.id })} className="bg-red-600 hover:bg-red-700">
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No problems added yet.</p>
          )}
        </div>
        <div className="flex justify-end">
          <Button onClick={() => handleAddProblemClick(contest._id)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Problem
          </Button>
        </div>
      </CardContent>
    </Card>
  )
  

  return (
    <Layout>
      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold">Course Contests</h1>
            <Button asChild>
                <Link to={`/admin/courses/${courseId}/contests/new`}>
                    <Plus className="mr-2 h-4 w-4" /> Create New Contest
                </Link>
            </Button>
        </div>

        <div className="mb-6">
            <Input
                type="text"
                placeholder="Search contests..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-sm"
            />
        </div>

        {contestsLoading && <p>Loading contests...</p>}
        {error && <p className="text-red-500">Error fetching contests.</p>}

        {contests && contests.length > 0 ? (
          <>
            <div className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Active & Upcoming Contests</h2>
              <div className="grid gap-6">
                {activeUpcomingContests?.map(renderContest)}
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-semibold mb-4">Past Contests</h2>
              <div className="grid gap-6">
                {pastContests?.map(renderContest)}
              </div>
            </div>
          </>
        ) : (
          !contestsLoading && <p>No contests found for this course.</p>
        )}
      </div>

      <ContestProblemEditorSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        contestId={selectedContestId}
        editingProblem={editingProblem}
      />
    </Layout>
  );
};

export default CourseContests;
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-react";
import { format } from "date-fns";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Course } from "@/lib/courses";
import { CalendarIcon, Trash2, Plus, User as UserIcon, Shield, BookOpen, Pencil, X, BarChart, Trophy } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import UserStats from "@/components/admin/UserStats";
// --- SCHEMAS ---

const sessionSchema = z.object({
  title: z.string().min(2, "Title is required"),
  courseId: z.string().min(1, "Course is required"),
  moduleId: z.string().optional(),
  topicId: z.string().optional(),
  startTime: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid start time"),
  endTime: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid end time"),
  description: z.string().optional(),
  status: z.enum(["scheduled", "live", "completed"]).optional(),
  recordingUrl: z.string().optional(),
});

const courseSchema = z.object({
  id: z.string().min(1, "ID is required (e.g., 'web-dev')"),
  name: z.string().min(2, "Name is required"),
  provider: z.string().default("Tharka High School"),
  amount: z.coerce.number().min(1, "Amount must be greater than 0"),
  description: z.string().optional(), // We'll treat this as a comma-separated string for input
});

type SessionFormData = z.infer<typeof sessionSchema>;
type CourseFormData = z.infer<typeof courseSchema>;

// --- COMPONENT ---

const CountdownTimer = ({ completedAt }: { completedAt: string }) => {
    const [timeLeft, setTimeLeft] = useState<string>("");

    useEffect(() => {
        const calculateTimeLeft = () => {
            const now = new Date().getTime();
            const deadline = new Date(completedAt).getTime() + 30 * 60 * 1000; // 30 minutes after completion
            const distance = deadline - now;

            if (distance < 0) {
                setTimeLeft("Disappearing...");
                return;
            }

            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

            setTimeLeft(`${minutes}m ${seconds}s`);
        };

        calculateTimeLeft(); // Initial call
        const interval = setInterval(calculateTimeLeft, 1000);

        return () => clearInterval(interval);
    }, [completedAt]);

    if (!completedAt) return null;

    return (
        <span className="text-xs font-bold text-amber-600 ml-2 font-mono bg-amber-50 px-2 py-0.5 rounded border border-amber-200 animate-pulse">
            Hides in: {timeLeft}
        </span>
    );
};

const API_URL = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';

const AdminDashboard = () => {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // --- QUERIES ---

  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ["adminSessions"],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch(`${API_URL}/admin/sessions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch sessions");
      return res.json();
    },
    refetchInterval: 15000, // Refetch every 15 seconds to auto-remove old sessions
  });

  const { data: courses, isLoading: coursesLoading } = useQuery<Course[]>({
    queryKey: ["courses"], // Public endpoint, but useful here
    queryFn: async () => {
      const res = await fetch(`${API_URL}/courses`);
      if (!res.ok) throw new Error("Failed to fetch courses");
      return res.json();
    },
  });

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["adminUsers"],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch(`${API_URL}/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
  });

  // --- FORMS ---
  const sessionForm = useForm<SessionFormData>({
    resolver: zodResolver(sessionSchema),
  });

  const selectedCourseId = sessionForm.watch("courseId");
  const selectedModuleId = sessionForm.watch("moduleId");

  const selectedCourse = courses?.find(c => c.id === selectedCourseId);
  const availableModules = selectedCourse?.modules || [];
  
  // Find selected module to get topics
  // Note: Module IDs in Select value are string representations of ObjectId
  const selectedModule = availableModules.find((m: any) => m._id === selectedModuleId);
  const availableTopics = selectedModule?.topics || [];

  const courseForm = useForm<CourseFormData>({
    resolver: zodResolver(courseSchema),
    defaultValues: {
      provider: "Tharka High School",
      amount: 999,
    }
  });

  const filteredUsers = users?.filter((user: any) => {
    const query = searchQuery.toLowerCase();
    return (
      user.name?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query) ||
      user.clerkId?.toLowerCase().includes(query)
    );
  });

  // --- MUTATIONS ---

  // Session Mutations
  const createSessionMutation = useMutation({
    mutationFn: async (data: SessionFormData) => {
      const token = await getToken();
      const res = await fetch(`${API_URL}/admin/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create session");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminSessions"] });
      toast({ title: "Success", description: "Session created successfully" });
      sessionForm.reset();
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteSessionMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      const res = await fetch(`${API_URL}/admin/sessions/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete session");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminSessions"] });
      toast({ title: "Success", description: "Session deleted" });
    },
  });

  const updateSessionMutation = useMutation({
    mutationFn: async (data: any) => {
      const token = await getToken();
      const res = await fetch(`${API_URL}/admin/sessions/${data._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update session");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminSessions"] });
      toast({ title: "Success", description: "Session updated" });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Course Mutations
  const createCourseMutation = useMutation({
    mutationFn: async (data: CourseFormData) => {
      const token = await getToken();
      // Convert comma-separated description to array
      const descriptionArray = data.description ? data.description.split(',').map(s => s.trim()) : [];
      
      const payload = { ...data, description: descriptionArray };

      const res = await fetch(`${API_URL}/admin/courses`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
          const err = await res.json();
          throw new Error(err.msg || "Failed to create course");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      toast({ title: "Success", description: "Course created successfully" });
      courseForm.reset();
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateCourseMutation = useMutation({
      mutationFn: async (data: CourseFormData) => {
          const token = await getToken();
          const descriptionArray = data.description ? data.description.split(',').map(s => s.trim()) : [];
          const payload = { ...data, description: descriptionArray };

          const res = await fetch(`${API_URL}/admin/courses/${data.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify(payload),
          });

          if (!res.ok) {
               const err = await res.json();
               throw new Error(err.msg || "Failed to update course");
          }
          return res.json();
      },
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["courses"] });
          toast({ title: "Success", description: "Course updated successfully" });
          setEditingCourse(null);
          courseForm.reset();
      },
      onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteCourseMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      const res = await fetch(`${API_URL}/admin/courses/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete course");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      toast({ title: "Success", description: "Course deleted" });
    },
  });

  // User Mutations
  const updateUserRoleMutation = useMutation({
    mutationFn: async ({ clerkId, role }: { clerkId: string; role: string }) => {
      const token = await getToken();
      const res = await fetch(`${API_URL}/admin/users/${clerkId}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error("Failed to update user role");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
      toast({ title: "Success", description: "User role updated" });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });


  // --- HELPERS ---
  const getStatusColor = (status: string) => {
      switch(status) {
          case 'live': return 'bg-red-100 text-red-700 border-red-200';
          case 'completed': return 'bg-gray-100 text-gray-700 border-gray-200';
          default: return 'bg-blue-100 text-blue-700 border-blue-200';
      }
  };

  const getCourseName = (id: string) => {
      const course = courses?.find(c => c.id === id);
      return course ? course.name : id;
  };

  const onSessionSubmit = (data: SessionFormData) => createSessionMutation.mutate(data);
  const onCourseSubmit = (data: CourseFormData) => {
      if (editingCourse) {
          updateCourseMutation.mutate(data);
      } else {
          createCourseMutation.mutate(data);
      }
  };

  const handleEditClick = (course: Course) => {
      setEditingCourse(course);
      courseForm.setValue("id", course.id);
      courseForm.setValue("name", course.name);
      courseForm.setValue("provider", course.provider);
      courseForm.setValue("amount", course.amount);
      courseForm.setValue("description", course.description.join(", "));
  };

  const handleCancelEdit = () => {
      setEditingCourse(null);
      courseForm.reset();
      courseForm.setValue("provider", "Tharka High School"); // Reset default
      courseForm.setValue("amount", 999);
  };

  return (
    <Layout>
      <div className="container mx-auto py-8 px-4">
        <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>

        <Tabs defaultValue="sessions" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="sessions">Live Sessions</TabsTrigger>
            <TabsTrigger value="courses">Courses</TabsTrigger>
            <TabsTrigger value="users">User Management</TabsTrigger>
          </TabsList>

          {/* --- SESSIONS TAB --- */}
          <TabsContent value="sessions">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card>
                <CardHeader>
                  <CardTitle>Schedule New Class</CardTitle>
                  <CardDescription>Set up a new live session for a course.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={sessionForm.handleSubmit(onSessionSubmit)} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Session Title</Label>
                      <Input id="title" {...sessionForm.register("title")} placeholder="e.g. Week 1: Introduction" />
                      {sessionForm.formState.errors.title && <p className="text-red-500 text-sm">{sessionForm.formState.errors.title.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="courseId">Course</Label>
                      <Select onValueChange={(val) => sessionForm.setValue("courseId", val)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a course" />
                        </SelectTrigger>
                        <SelectContent>
                            {coursesLoading ? (
                                <SelectItem value="loading" disabled>Loading courses...</SelectItem>
                            ) : courses && courses.map(course => (
                                <SelectItem key={course.id} value={course.id}>{course.name}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      {sessionForm.formState.errors.courseId && <p className="text-red-500 text-sm">{sessionForm.formState.errors.courseId.message}</p>}
                    </div>

                    {/* Module Selection */}
                    {availableModules.length > 0 && (
                        <div className="space-y-2">
                            <Label htmlFor="moduleId">Module</Label>
                            <Select onValueChange={(val) => {
                                sessionForm.setValue("moduleId", val);
                                sessionForm.setValue("topicId", ""); // Reset topic when module changes
                            }}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a module" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableModules.map((mod: any) => (
                                        <SelectItem key={mod._id} value={mod._id}>{mod.title}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {sessionForm.formState.errors.moduleId && <p className="text-red-500 text-sm">{sessionForm.formState.errors.moduleId.message}</p>}
                        </div>
                    )}

                    {/* Topic Selection */}
                    {availableTopics.length > 0 && (
                        <div className="space-y-2">
                            <Label htmlFor="topicId">Topic</Label>
                            <Select onValueChange={(val) => sessionForm.setValue("topicId", val)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a topic" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableTopics.map((topic: any) => (
                                        <SelectItem key={topic._id} value={topic._id}>{topic.title}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {sessionForm.formState.errors.topicId && <p className="text-red-500 text-sm">{sessionForm.formState.errors.topicId.message}</p>}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="startTime">Start Time</Label>
                            <Input id="startTime" type="datetime-local" {...sessionForm.register("startTime")} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="endTime">End Time</Label>
                            <Input id="endTime" type="datetime-local" {...sessionForm.register("endTime")} />
                        </div>
                    </div>

                    <Button type="submit" className="w-full" disabled={createSessionMutation.isPending}>
                      {createSessionMutation.isPending ? "Scheduling..." : "Schedule Class"}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Scheduled Classes</CardTitle>
                  <CardDescription>Manage upcoming sessions.</CardDescription>
                </CardHeader>
                <CardContent>
                  {sessionsLoading ? (
                    <p>Loading sessions...</p>
                  ) : sessions && sessions.length > 0 ? (
                    <div className="space-y-4">
                      {sessions.map((session: any) => {
                        const isLive = session.status !== 'completed' && new Date() >= new Date(session.startTime);
                        const displayStatus = session.status === 'completed' ? 'completed' : (isLive ? 'live' : 'scheduled');
                        
                        return (
                        <div key={session._id} className="flex flex-col gap-2 p-4 border rounded-lg">
                          <div className="flex items-start justify-between">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="font-semibold">{session.title}</h3>
                                    <span className={`text-[10px] uppercase px-2 py-0.5 rounded border ${getStatusColor(displayStatus)}`}>
                                        {displayStatus}
                                    </span>
                                </div>
                                <p className="text-sm text-muted-foreground">{getCourseName(session.courseId)}</p>
                                <div className="flex items-center gap-2 text-sm mt-1">
                                    <CalendarIcon className="h-4 w-4" />
                                    <span>
                                        {format(new Date(session.startTime), "PP p")}
                                    </span>
                                </div>
                            </div>
                            <div className="flex gap-1">
                                {session.startUrl && (
                                    session.status === 'completed' ? (
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            className="bg-amber-500 hover:bg-amber-600 text-white border-none"
                                            onClick={() => {
                                                updateSessionMutation.mutate({ _id: session._id, status: 'scheduled' });
                                                window.open(session.startUrl, '_blank');
                                            }}
                                        >
                                            Restart Class
                                        </Button>
                                    ) : (
                                        <Button 
                                            variant="default" 
                                            size="sm" 
                                            className="bg-green-600 hover:bg-green-700"
                                            onClick={() => window.open(session.startUrl, '_blank')}
                                        >
                                            Start Class
                                        </Button>
                                    )
                                )}
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-50">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Session?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                        This will remove the session "{session.title}".
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => deleteSessionMutation.mutate(session._id)} className="bg-red-600 hover:bg-red-700">
                                        Delete
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                          </div>
                          
                          {/* Management Controls */}
                          <div className="flex items-center gap-2 mt-2 pt-2 border-t">
                              <Badge variant="outline" className={`text-[10px] font-bold ${getStatusColor(displayStatus)}`}>
                                  {displayStatus === 'live' ? '🔴 LIVE NOW' : displayStatus.toUpperCase()}
                              </Badge>
                              {displayStatus === 'completed' && <CountdownTimer completedAt={session.updatedAt || session.endTime} />}

                          </div>
                        </div>
                      )})}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No sessions scheduled.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* --- COURSES TAB --- */}
          <TabsContent value="courses">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card>
                    <CardHeader>
                        <CardTitle>{editingCourse ? "Edit Course" : "Add New Course"}</CardTitle>
                        <CardDescription>
                            {editingCourse ? "Update course details." : "Create a new course offering."}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                         <form onSubmit={courseForm.handleSubmit(onCourseSubmit)} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="c-id">Course ID (Slug)</Label>
                                <Input 
                                    id="c-id" 
                                    {...courseForm.register("id")} 
                                    placeholder="e.g. advanced-dsa" 
                                    disabled={!!editingCourse} // Cannot edit ID as it's the lookup key
                                />
                                {courseForm.formState.errors.id && <p className="text-red-500 text-sm">{courseForm.formState.errors.id.message}</p>}
                                {editingCourse && <p className="text-xs text-muted-foreground">ID cannot be changed after creation.</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="c-name">Course Name</Label>
                                <Input id="c-name" {...courseForm.register("name")} placeholder="e.g. Advanced DSA" />
                                {courseForm.formState.errors.name && <p className="text-red-500 text-sm">{courseForm.formState.errors.name.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="c-amount">Amount (INR)</Label>
                                <Input id="c-amount" type="number" {...courseForm.register("amount")} />
                                {courseForm.formState.errors.amount && <p className="text-red-500 text-sm">{courseForm.formState.errors.amount.message}</p>}
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="c-desc">Description (Comma separated)</Label>
                                <Input id="c-desc" {...courseForm.register("description")} placeholder="Topic 1, Topic 2, Topic 3" />
                            </div>
                            
                            <div className="flex gap-2">
                                <Button type="submit" className="flex-1" disabled={createCourseMutation.isPending || updateCourseMutation.isPending}>
                                    {createCourseMutation.isPending || updateCourseMutation.isPending 
                                        ? "Saving..." 
                                        : (editingCourse ? "Update Course" : "Create Course")}
                                </Button>
                                {editingCourse && (
                                    <Button type="button" variant="outline" onClick={handleCancelEdit}>
                                        Cancel
                                    </Button>
                                )}
                            </div>
                         </form>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Existing Courses</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {coursesLoading ? <p>Loading...</p> : (
                             <div className="space-y-4">
                                {courses?.map(course => (
                                    <div key={course.id} className={`flex items-center justify-between p-4 border rounded-lg ${editingCourse?.id === course.id ? 'border-primary bg-accent/10' : ''}`}>
                                        <div>
                                            <h3 className="font-bold">{course.name}</h3>
                                            <p className="text-xs text-muted-foreground">ID: {course.id}</p>
                                            <p className="text-sm font-semibold text-primary">₹{course.amount}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button variant="outline" size="sm" onClick={() => navigate(`/admin/courses/${course.id}/builder`)}>
                                                <BookOpen className="h-4 w-4 mr-2" />
                                                Content
                                            </Button>
                                            <Button variant="outline" size="sm" onClick={() => navigate(`/admin/courses/${course.id}/contests`)}>
                                                <Trophy className="h-4 w-4 mr-2" />
                                                Contests
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleEditClick(course)}>
                                                <Pencil className="h-4 w-4 text-blue-500" />
                                            </Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-50">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Delete Course?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            This will permanently delete "{course.name}". This action cannot be undone.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => deleteCourseMutation.mutate(course.id)} className="bg-red-600 hover:bg-red-700">
                                                            Delete
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </div>
                                ))}
                             </div>
                        )}
                    </CardContent>
                </Card>
            </div>
          </TabsContent>

          {/* --- USERS TAB --- */}
          <TabsContent value="users">
            <Card>
                <CardHeader>
                    <CardTitle>User Management</CardTitle>
                    <CardDescription>Manage user roles and permissions.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Input
                        type="text"
                        placeholder="Search users by name, email, or ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="mb-4 max-w-sm"
                    />
                    {usersLoading ? <p>Loading users...</p> : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>First Accessed</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredUsers?.map((user: any) => (
                                    <TableRow key={user._id}>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{user.name || "N/A"}</span>
                                                <span className="text-xs text-muted-foreground font-mono">{user.clerkId}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>{user.email || "N/A"}</TableCell>
                                        <TableCell>
                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}`}>
                                                {user.role}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            {user.createdAt ? format(new Date(user.createdAt), "PP") : 'N/A'}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex gap-2">
                                                {user.role === 'user' ? (
                                                    <Button size="sm" variant="outline" onClick={() => updateUserRoleMutation.mutate({ clerkId: user.clerkId, role: 'admin' })}>
                                                        <Shield className="h-3 w-3 mr-2" />
                                                        Make Admin
                                                    </Button>
                                                ) : (
                                                    <Button size="sm" variant="outline" onClick={() => updateUserRoleMutation.mutate({ clerkId: user.clerkId, role: 'user' })}>
                                                        <UserIcon className="h-3 w-3 mr-2" />
                                                        Make User
                                                    </Button>
                                                )}
                                                <Button size="sm" variant="outline" onClick={() => setSelectedUser(user)}>
                                                    <BarChart className="h-3 w-3 mr-2" />
                                                    Stats
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                                                            )}
                                                        </CardContent>
                                                    </Card>
                                                  </TabsContent>
                                                </Tabs>
                                                
                                                <Dialog open={!!selectedUser} onOpenChange={(isOpen) => !isOpen && setSelectedUser(null)}>
                                                    <DialogContent className="max-w-4xl">
                                                        <DialogHeader>
                                                            <DialogTitle>Statistics for {selectedUser?.name}</DialogTitle>
                                                        </DialogHeader>
                                                        {selectedUser && <UserStats userId={selectedUser.clerkId} />}
                                                    </DialogContent>
                                                </Dialog>
                                              </div>
                                            </Layout>
                                          );};

export default AdminDashboard;
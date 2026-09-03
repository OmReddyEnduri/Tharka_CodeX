import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Course as CourseType, Topic, Problem, Video } from "@/lib/courses";
import { Button } from "@/components/ui/button";
import { SignedIn, SignedOut, SignInButton, useAuth } from "@clerk/clerk-react";
import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { Loader2, PlayCircle, FileText, CheckCircle, Lock, Menu, ArrowLeft } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const Course = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const { getToken, isLoaded, userId } = useAuth();
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);

  // Fetch all courses (public info)
  const { data: courses, isLoading: isCoursesLoading } = useQuery<CourseType[]>({
    queryKey: ["courses"],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/courses`);
      if (!res.ok) throw new Error("Failed to fetch courses");
      return res.json();
    },
  });

  // Fetch user's purchased courses
  const { data: myCourses, isLoading: isMyCoursesLoading } = useQuery<CourseType[]>({
    queryKey: ["my-courses", userId],
    enabled: !!userId,
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/users/me/courses`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error("Failed to fetch my courses");
      return res.json();
    },
  });

  // Fetch user profile (to check role)
  const { data: userProfile } = useQuery({
    queryKey: ["user-profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/users/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error("Failed to fetch profile");
      return res.json();
    },
  });

  const isPurchased = myCourses?.some((c) => c.id === courseId) || userProfile?.role === 'admin';

  // Fetch FULL course content (Protected)
  // Only fetch if we are authorized (purchased or admin)
  const { data: fullCourse, isLoading: isFullCourseLoading } = useQuery<CourseType>({
    queryKey: ["course-full", courseId],
    enabled: !!userId && isPurchased,
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/courses/${courseId}/full`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error("Failed to fetch full course content");
      return res.json();
    },
  });

  // Prioritize full content -> then purchased list (if available) -> then public list
  const course = fullCourse || myCourses?.find((c) => c.id === courseId) || courses?.find((c) => c.id === courseId);
  
  const isLoading = isCoursesLoading || (!!userId && isMyCoursesLoading) || (!!userId && isPurchased && isFullCourseLoading);

  // Auto-select the first topic if available and not selected
  useEffect(() => {
    if (course?.modules && course.modules.length > 0 && !selectedTopic) {
        // Find the first module with topics
        const firstModuleWithTopics = course.modules.find(m => m.topics && m.topics.length > 0);
        if (firstModuleWithTopics) {
            setSelectedTopic(firstModuleWithTopics.topics[0]);
        }
    }
  }, [course, selectedTopic]);


  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!course) {
    return (
      <Layout>
        <div className="container px-4 md:px-6 py-16 text-center">
          <h1 className="text-3xl font-bold">Course not found</h1>
          <Button className="mt-4" asChild variant="outline">
            <Link to="/courses">Browse Courses</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  // --- LEARNING VIEW (If Purchased) ---
  if (isPurchased) {
    const SidebarContent = () => (
      <div className="h-full py-4">
        <div className="px-4 mb-4 space-y-4">
            <Button variant="ghost" size="sm" asChild className="-ml-2 h-8 gap-1 text-muted-foreground hover:text-foreground">
                <Link to="/my-courses">
                    <ArrowLeft className="h-4 w-4" />
                    Back to My Courses
                </Link>
            </Button>
            <div>
                <h2 className="font-semibold text-lg">{course.name}</h2>
                <p className="text-sm text-muted-foreground">{course.provider}</p>
            </div>
        </div>
        <ScrollArea className="h-[calc(100vh-200px)]">
          <Accordion type="multiple" className="w-full px-2" defaultValue={course.modules?.map((_, i) => `item-${i}`) || []}>
            {course.modules?.map((module, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="px-2 hover:no-underline hover:bg-muted/50 rounded-md">
                    <div className="text-left">
                        <div className="text-sm font-medium">{module.title}</div>
                        {module.description && <div className="text-xs text-muted-foreground font-normal">{module.description}</div>}
                    </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="flex flex-col gap-1 mt-1 pl-2">
                    {module.topics?.map((topic, tIndex) => (
                      <button
                        key={tIndex}
                        onClick={() => setSelectedTopic(topic)}
                        className={`text-left text-sm py-2 px-3 rounded-md transition-colors flex items-center gap-2 ${
                          selectedTopic === topic
                            ? "bg-primary/10 text-primary font-medium"
                            : "hover:bg-muted text-muted-foreground"
                        }`}
                      >
                         {/* Simple icon logic: video vs problem mix */}
                        <div className="h-2 w-2 rounded-full bg-current shrink-0" />
                        {topic.title}
                      </button>
                    ))}
                    {(!module.topics || module.topics.length === 0) && (
                        <div className="text-xs text-muted-foreground pl-4 py-2 italic">No topics yet</div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
             {(!course.modules || course.modules.length === 0) && (
                <div className="px-4 py-4 text-sm text-muted-foreground">No modules available.</div>
            )}
          </Accordion>
        </ScrollArea>
      </div>
    );

    return (
      <Layout>
        <Helmet>
          <title>{course.name} - Learning</title>
        </Helmet>
        <div className="flex h-[calc(100vh-4rem)]">
          {/* Desktop Sidebar */}
          <div className="hidden md:block w-80 border-r bg-card/50">
            <SidebarContent />
          </div>

          {/* Mobile Sidebar Trigger */}
          <div className="md:hidden absolute top-20 left-4 z-10">
              <Sheet>
                  <SheetTrigger asChild>
                      <Button variant="outline" size="icon">
                          <Menu className="h-4 w-4" />
                      </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="p-0 w-80">
                      <SidebarContent />
                  </SheetContent>
              </Sheet>
          </div>


          {/* Main Content Area */}
          <div className="flex-1 overflow-auto bg-background p-6 md:p-10">
            {selectedTopic ? (
              <div className="max-w-4xl mx-auto space-y-8">
                <div>
                  <h1 className="text-3xl font-bold mb-2">{selectedTopic.title}</h1>
                  <p className="text-muted-foreground">{selectedTopic.description}</p>
                </div>

                <Tabs defaultValue="problems" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
                    <TabsTrigger value="problems">Problems ({selectedTopic.problems?.length || 0})</TabsTrigger>
                    <TabsTrigger value="videos">Videos ({selectedTopic.videos?.length || 0})</TabsTrigger>
                  </TabsList>

                  <TabsContent value="problems" className="mt-6 space-y-4">
                    {selectedTopic.problems?.map((problem) => (
                      <Card key={problem.id}>
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="text-xl mb-1">{problem.title}</CardTitle>
                                    <CardDescription className="flex items-center gap-2">
                                        <Badge className={
                                            problem.difficulty === "Easy" ? "bg-green-100 text-green-700 hover:bg-green-100 border-green-200" : 
                                            problem.difficulty === "Medium" ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-yellow-200" : 
                                            "bg-red-100 text-red-700 hover:bg-red-100 border-red-200"
                                        }>
                                            {problem.difficulty}
                                        </Badge>
                                    </CardDescription>
                                </div>
                                <Button size="sm" variant="outline" asChild>
                                    <Link to={`/course/${courseId}/problem/${problem.id}`}>Solve</Link>
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground line-clamp-2">{problem.description}</p>
                        </CardContent>
                      </Card>
                    ))}
                    {(!selectedTopic.problems || selectedTopic.problems.length === 0) && (
                        <div className="text-center py-10 text-muted-foreground">
                            <CheckCircle className="h-10 w-10 mx-auto mb-2 opacity-20" />
                            <p>No problems in this topic yet.</p>
                        </div>
                    )}
                  </TabsContent>

                  <TabsContent value="videos" className="mt-6 space-y-4">
                    {selectedTopic.videos?.map((video, index) => (
                      <Card key={index}>
                        <CardHeader>
                            <div className="flex items-start gap-4">
                                <div className="mt-1 bg-primary/10 p-2 rounded-full text-primary">
                                    <PlayCircle className="h-6 w-6" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg">{video.title}</CardTitle>
                                    {video.description && <CardDescription>{video.description}</CardDescription>}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="aspect-video bg-black rounded-md overflow-hidden">
                                <video 
                                    controls 
                                    className="w-full h-full" 
                                    src={video.url}
                                    poster="/placeholder.svg" // Optional: You might want to generate thumbnails later
                                >
                                    Your browser does not support the video tag.
                                </video>
                            </div>
                        </CardContent>
                      </Card>
                    ))}
                     {(!selectedTopic.videos || selectedTopic.videos.length === 0) && (
                        <div className="text-center py-10 text-muted-foreground">
                            <PlayCircle className="h-10 w-10 mx-auto mb-2 opacity-20" />
                            <p>No videos in this topic yet.</p>
                        </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground space-y-4">
                <FileText className="h-16 w-16 opacity-20" />
                <h2 className="text-xl font-semibold">Select a topic to start learning</h2>
                <p className="max-w-md">Choose a module from the sidebar to view its topics and content.</p>
              </div>
            )}
          </div>
        </div>
      </Layout>
    );
  }

  // --- SALES VIEW (If Not Purchased) ---
  return (
    <Layout>
      <Helmet>
        <title>{course.name} - Tharka High School</title>
        <meta name="description" content={`Details for ${course.name}`} />
      </Helmet>
      <section className="py-16 bg-background">
        <div className="container px-4 md:px-6">
          <div className="max-w-3xl mx-auto">
            <div className="space-y-6">
              <section>
                <Button variant="ghost" size="sm" asChild className="-ml-2 mb-4 h-8 gap-1 text-muted-foreground hover:text-foreground">
                    <Link to="/my-courses">
                        <ArrowLeft className="h-4 w-4" />
                        Back to My Courses
                    </Link>
                </Button>
                <h1 className="text-4xl font-bold mb-2 text-foreground">
                  {course.name}
                </h1>
                <p className="text-lg text-muted-foreground mb-8">
                  Provider: {course.provider}
                </p>

              
                <div className="bg-card p-6 rounded-lg shadow-sm">
                  <h2 className="text-2xl font-semibold mb-4 text-foreground">
                    Topics Covered
                  </h2>
                   {/* Fallback description if modules are missing, or show module titles */}
                   {course.modules && course.modules.length > 0 ? (
                       <Accordion type="single" collapsible className="w-full">
                           {course.modules.map((module, i) => (
                               <AccordionItem key={i} value={`preview-${i}`}>
                                   <AccordionTrigger className="font-medium">
                                       <span className="flex items-center gap-2">
                                           <Lock className="h-3 w-3" /> {module.title}
                                       </span>
                                   </AccordionTrigger>
                                   <AccordionContent className="text-muted-foreground">
                                       {module.description || "Unlock to view content."}
                                       <div className="mt-2 text-xs">
                                           {module.topics.length} Topics
                                       </div>
                                   </AccordionContent>
                               </AccordionItem>
                           ))}
                       </Accordion>
                   ) : (
                      <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                        {course.description.map((item, index) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ul>
                   )}
                </div>

                <div className="mt-8 text-center">
                  <p className="text-muted-foreground">
                    You do not have access to this course. Please contact an admin to get access.
                  </p>
                </div>
              </section>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Course;

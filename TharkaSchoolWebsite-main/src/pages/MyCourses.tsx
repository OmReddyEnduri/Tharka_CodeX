import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Layout } from '@/components/layout/Layout';
import { useAuth, useUser } from '@clerk/clerk-react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CalendarIcon, Video, Radio, Clock, PlayCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const fetchMyCourses = async (token: string | null) => {
  if (!token) {
    throw new Error("Not authenticated");
  }
  const response = await fetch(`${import.meta.env.VITE_API_URL}/api/users/me/courses`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (!response.ok) {
    throw new Error('Failed to fetch courses');
  }
  return response.json();
};

const fetchMySessions = async (token: string | null) => {
  if (!token) {
    throw new Error("Not authenticated");
  }
  const response = await fetch(`${import.meta.env.VITE_API_URL}/api/my-sessions`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (!response.ok) {
    throw new Error('Failed to fetch sessions');
  }
  return response.json();
};

const MyCourses = () => {
  const { getToken } = useAuth();
  const { user } = useUser();
  
  const { data: userData } = useQuery({
    queryKey: ["currentUserRole"],
    queryFn: async () => {
      try {
        if (!user) return null;
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/users/me`, {
          headers: {
            Authorization: `Bearer ${await getToken()}`,
          },
        });

        if (!res.ok) return null;
        return res.json();
      } catch (error) {
        return null;
      }
    },
    enabled: !!user,
    retry: false,
  });

  const isAdmin = userData?.role === "admin";
  
  const { data: courses, isLoading: coursesLoading, isError: coursesError, error: coursesErrorData } = useQuery({
    queryKey: ['myCourses'],
    queryFn: async () => {
      const token = await getToken();
      return fetchMyCourses(token);
    },
  });

  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['mySessions'],
    queryFn: async () => {
      const token = await getToken();
      return fetchMySessions(token);
    },
    refetchInterval: 60000, // Refetch every minute to update status
  });

  const now = new Date();
  
  const ongoingSessions = sessions?.filter((session: any) => {
    const start = new Date(session.startTime);
    return start <= now && session.status !== 'completed';
  }) || [];

  const upcomingSessions = sessions?.filter((session: any) => {
    const start = new Date(session.startTime);
    return start > now && session.status !== 'completed';
  }) || [];

  const completedSessions = sessions?.filter((session: any) => {
      return session.status === 'completed';
  }) || [];

  return (
    <Layout>
      <div className="container mx-auto py-8 px-4">
        
        {/* Ongoing Sessions Section */}
        {ongoingSessions.length > 0 && (
          <div className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="flex items-center gap-3 mb-6">
                <span className="relative flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span>
                </span>
                <h1 className="text-3xl font-bold text-red-500">
                  Live Now
                </h1>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {ongoingSessions.map((session: any) => (
                    <Card key={session._id} className="border-2 border-red-500/50 shadow-xl bg-red-50/10">
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="text-xl">{session.title}</CardTitle>
                                    <CardDescription className="text-red-500 font-medium">
                                        {courses?.find((c: any) => c.id === session.courseId)?.name}
                                    </CardDescription>
                                </div>
                                <Badge variant="destructive" className="animate-pulse">LIVE</Badge>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-sm">
                                    <Clock className="h-4 w-4 text-red-500" />
                                    <span className="font-medium text-red-600">
                                        Ends at {format(new Date(session.endTime), "p")}
                                    </span>
                                </div>
                                <p className="text-sm line-clamp-2">{session.description}</p>
                                {!isAdmin && (
                                    <Button asChild className="w-full bg-red-600 hover:bg-red-700 text-white font-bold">
                                        <Link to={`/classroom/${session._id}/zoom`}>
                                            Join Classroom
                                        </Link>
                                    </Button>
                                )}
                                {isAdmin && (
                                    <div className="text-center p-2 rounded bg-red-100 border border-red-200 text-red-700 font-medium text-sm">
                                        Active Class (Admin View)
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
          </div>
        )}

        {/* Upcoming Sessions Section */}
        <div className="mb-12">
            <h1 className="text-2xl font-bold mb-6 flex items-center gap-2 text-foreground">
                <CalendarIcon className="h-6 w-6" />
                Upcoming Live Classes
            </h1>
            {sessionsLoading ? (
                <p>Loading sessions...</p>
            ) : upcomingSessions.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {upcomingSessions.map((session: any) => (
                        <Card key={session._id} className="border-l-4 border-l-primary hover:shadow-md transition-all">
                            <CardHeader>
                                <CardTitle className="text-lg">{session.title}</CardTitle>
                                <CardDescription>
                                    {courses?.find((c: any) => c.id === session.courseId)?.name || "Course Session"}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <CalendarIcon className="h-4 w-4" />
                                        <span>
                                            {format(new Date(session.startTime), "PPP p")}
                                        </span>
                                    </div>
                                    <p className="text-sm line-clamp-2 text-muted-foreground">{session.description}</p>
                                    <Button variant="outline" disabled className="w-full">
                                        Starts {format(new Date(session.startTime), "PP p")}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="bg-secondary/20 p-6 rounded-lg border border-border">
                    <p className="text-muted-foreground">No upcoming classes scheduled.</p>
                </div>
            )}
        </div>

        {/* Completed Sessions Section */}
        {completedSessions.length > 0 && (
            <div className="mb-12">
                <h1 className="text-2xl font-bold mb-6 flex items-center gap-2 text-foreground">
                    <PlayCircle className="h-6 w-6" />
                    Past Classes & Recordings
                </h1>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {completedSessions.map((session: any) => (
                        <Card key={session._id} className="opacity-75 hover:opacity-100 transition-opacity">
                            <CardHeader>
                                <CardTitle className="text-lg">{session.title}</CardTitle>
                                <CardDescription>
                                    {format(new Date(session.startTime), "PPP")}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <Button 
                                        variant={session.recordingUrl ? "default" : "secondary"} 
                                        className="w-full" 
                                        disabled={!session.recordingUrl}
                                        onClick={() => session.recordingUrl && window.open(session.recordingUrl, '_blank')}
                                    >
                                        {session.recordingUrl ? (
                                            <>
                                                <PlayCircle className="h-4 w-4 mr-2" />
                                                Watch Recording
                                            </>
                                        ) : (
                                            "Recording Processing..."
                                        )}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        )}

        <div className="border-t border-border my-8"></div>

        {/* Courses Section */}
        <div>
            <h2 className="text-2xl font-bold mb-6">My Enrolled Courses</h2>
            {coursesLoading && <p>Loading...</p>}
            {coursesError && <p className="text-red-500">{(coursesErrorData as Error).message}</p>}
            {courses && courses.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {courses.map((course: any) => (
                <Card key={course.id} className="flex flex-col h-full">
                    <CardHeader>
                    <CardTitle>{course.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col justify-between">
                    <p className="text-muted-foreground mb-4">{course.description.slice(0, 3).join(', ')}...</p>
                    <div className="flex flex-col gap-2 mt-auto">
                        <Button variant="outline" asChild>
                            <Link to={`/course/${course.id}`}>
                                Go to Course Material
                            </Link>
                        </Button>
                        <Button variant="default" asChild>
                            <Link to={`/course/${course.id}/contests`}>
                                View Contests
                            </Link>
                        </Button>
                    </div>
                    </CardContent>
                </Card>
                ))}
            </div>
            ) : (
            !coursesLoading && !coursesError && <p>You have not purchased any courses yet.</p>
            )}
        </div>
      </div>
    </Layout>
  );
};

export default MyCourses;

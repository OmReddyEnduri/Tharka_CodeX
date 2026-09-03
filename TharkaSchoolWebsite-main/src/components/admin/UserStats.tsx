import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CheckCircle, XCircle, AlertCircle, Clock, Code } from "lucide-react";
import { format, formatDistanceToNow } from 'date-fns';
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface UserStatsProps {
  userId: string;
}

interface VerdictStat {
  name: string;
  value: number;
}

const COLORS: { [key: string]: string } = {
  'Accepted': '#22c55e', // green-500
  'Wrong Answer': '#ef4444', // red-500
  'Time Limit Exceeded': '#f97316', // orange-500
  'Compilation Error': '#eab308', // yellow-500
  'Runtime Error': '#a855f7', // purple-500
  'TLE': '#f97316',
};
const FALLBACK_COLOR = '#64748b'; // slate-500

const VERDICT_STYLES: { [key: string]: string } = {
    'Accepted': 'text-green-500',
    'Wrong Answer': 'text-red-500',
    'Time Limit Exceeded': 'text-orange-500',
    'Compilation Error': 'text-yellow-500',
    'Runtime Error': 'text-purple-500',
    'TLE': 'text-orange-500',
};

const VERDICT_ICONS: { [key: string]: React.ElementType } = {
    'Accepted': CheckCircle,
    'Wrong Answer': XCircle,
    'Time Limit Exceeded': Clock,
    'Compilation Error': Code,
    'Runtime Error': AlertCircle,
    'TLE': Clock,
};

const UserStats = ({ userId }: UserStatsProps) => {
  const { getToken } = useAuth();

  const { data: stats, isLoading, isError, error } = useQuery({
    queryKey: ["userStats", userId],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/users/${userId}/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error("Failed to fetch user statistics");
      }
      return res.json();
    },
    enabled: !!userId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Loading stats...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  }

  const { 
    totalSubmissions, 
    verdicts,
    problemsAttempted,
    problemsSolved,
    lastSubmitted,
    recentSubmissions,
  } = stats;

  if (totalSubmissions === 0) {
    return (
        <div className="text-center py-10">
            <p className="text-muted-foreground">No submissions found for this user.</p>
        </div>
    )
  }

  return (
    <div className="max-h-[70vh] overflow-y-auto pr-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 text-center">
            <div className="p-4 bg-slate-100 rounded-lg">
                <p className="text-sm text-muted-foreground">Total Submissions</p>
                <p className="text-2xl font-bold">{totalSubmissions}</p>
            </div>
            <div className="p-4 bg-slate-100 rounded-lg">
                <p className="text-sm text-muted-foreground">Problems Attempted</p>
                <p className="text-2xl font-bold">{problemsAttempted}</p>
            </div>
            <div className="p-4 bg-slate-100 rounded-lg">
                <p className="text-sm text-muted-foreground">Problems Solved</p>
                <p className="text-2xl font-bold">{problemsSolved}</p>
            </div>
            <div className="p-4 bg-slate-100 rounded-lg">
                <p className="text-sm text-muted-foreground">Acceptance Rate</p>
                <p className="text-2xl font-bold">
                    {totalSubmissions > 0 ? `${((verdicts.find(v => v.name === 'Accepted')?.value || 0) / totalSubmissions * 100).toFixed(1)}%` : 'N/A'}
                </p>
            </div>
        </div>

        {/* Chart */}
        <div className="w-full h-80">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                <Pie
                    data={verdicts}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    nameKey="name"
                    label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                        if (percent === 0) return null;
                        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                        const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180));
                        const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));
                        return (
                        <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={12}>
                            {`${(percent * 100).toFixed(0)}%`}
                        </text>
                        );
                    }}
                >
                    {verdicts.map((entry: VerdictStat) => (
                    <Cell key={`cell-${entry.name}`} fill={COLORS[entry.name] || FALLBACK_COLOR} />
                    ))}
                </Pie>
                <Tooltip formatter={(value: number, name: string) => [`${value} (${((value / totalSubmissions) * 100).toFixed(1)}%)`, name]}/>
                <Legend />
                </PieChart>
            </ResponsiveContainer>
        </div>

        <Separator className="my-6" />

        {/* Recent Activity */}
        <div>
            <h3 className="text-lg font-semibold mb-2">Recent Activity</h3>
            {lastSubmitted && (
                <p className="text-sm text-muted-foreground mb-4">
                    Last submission: {formatDistanceToNow(new Date(lastSubmitted), { addSuffix: true })}
                </p>
            )}

            <div className="space-y-3">
                {recentSubmissions.map((sub: any, index: number) => {
                    const Icon = VERDICT_ICONS[sub.verdict] || AlertCircle;
                    return (
                        <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-md">
                            <div>
                                <p className="font-medium">{sub.problemTitle}</p>
                                <div className="flex items-center gap-1.5">
                                    <Icon className={`h-4 w-4 ${VERDICT_STYLES[sub.verdict] || 'text-slate-500'}`} />
                                    <p className={`text-sm font-semibold ${VERDICT_STYLES[sub.verdict] || 'text-slate-500'}`}>{sub.verdict}</p>
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(sub.submittedAt), { addSuffix: true })}
                            </p>
                        </div>
                    )
                })}
            </div>
        </div>

    </div>
  );
};
export default UserStats;
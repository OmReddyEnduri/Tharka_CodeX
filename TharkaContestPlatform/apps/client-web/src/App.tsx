import { Routes, Route } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useSyncSocket } from "@/lib/useSyncSocket";
import Home from "@/pages/Home";
import Settings from "@/pages/Settings";
import JoinContest from "@/pages/JoinContest";
import Contest from "@/pages/Contest";
import ContestProblem from "@/pages/ContestProblem";
import Leaderboard from "@/pages/Leaderboard";
import Compiler from "@/pages/Compiler";

export default function App() {
  const queryClient = useQueryClient();
  useSyncSocket(queryClient);

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/compiler" element={<Compiler />} />
      <Route path="/contest/:contestId/join" element={<JoinContest />} />
      <Route path="/contest/:contestId" element={<Contest />} />
      <Route path="/contest/:contestId/leaderboard" element={<Leaderboard />} />
      <Route path="/contest/:contestId/problem/:problemId" element={<ContestProblem />} />
    </Routes>
  );
}

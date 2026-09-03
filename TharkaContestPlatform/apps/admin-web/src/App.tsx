import { Routes, Route } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import AdminContestsList from "@/pages/AdminContestsList";
import CreateContest from "@/pages/CreateContest";
import ContestDetail from "@/pages/ContestDetail";
import AdminResults from "@/pages/AdminResults";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<AdminContestsList />} />
        <Route path="/contests/new" element={<CreateContest />} />
        <Route path="/contests/:contestId/edit" element={<CreateContest />} />
        <Route path="/contests/:contestId" element={<ContestDetail />} />
        <Route path="/contests/:contestId/results" element={<AdminResults />} />
      </Route>
    </Routes>
  );
}

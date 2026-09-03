// Shared by GET /api/contests/:contestId/results (live, on-demand) and
// GET /api/sync/full (embeds each contest's leaderboard so it travels down
// to the Electron client on sync, viewable offline afterward) - kept in one
// place so the two never drift apart.
function computeLeaderboard(contest, submissions) {
  // Defense in depth against already-stored late submissions (e.g. from
  // before the endTime check existed, or a spoofed client timestamp that
  // slipped through) - the leaderboard must never move once the contest
  // has ended, regardless of what's sitting in the submissions collection.
  const cutoff = contest.endTime ? new Date(contest.endTime) : null;
  const validSubmissions = cutoff
    ? submissions.filter((sub) => new Date(sub.submittedAt) <= cutoff)
    : submissions;

  const leaderboard = {};
  for (const sub of validSubmissions) {
    const key = sub.studentRollNumber;
    if (!leaderboard[key]) {
      leaderboard[key] = {
        studentName: sub.studentName,
        studentRollNumber: sub.studentRollNumber,
        scores: {},
        totalScore: 0,
      };
    }

    if (leaderboard[key].scores[sub.contestProblemId]?.verdict !== "Accepted") {
      const timeInMinutes = Math.floor(
        (new Date(sub.submittedAt).getTime() - new Date(contest.startTime).getTime()) / (1000 * 60)
      );
      const previousAttempts = leaderboard[key].scores[sub.contestProblemId]?.attempts || 0;
      leaderboard[key].scores[sub.contestProblemId] = {
        verdict: sub.verdict,
        score: sub.verdict === "Accepted" ? 100 : 0,
        time: timeInMinutes,
        attempts: previousAttempts + 1,
      };
    }
  }

  for (const key in leaderboard) {
    leaderboard[key].totalScore = Object.values(leaderboard[key].scores).reduce((acc, s) => acc + s.score, 0);
  }

  const dqSet = new Set((contest.disqualifiedStudents || []).map((d) => d.studentRollNumber));

  // Disqualified students keep their computed score (for the admin's
  // record) but are sorted to the bottom regardless of it, below everyone
  // still eligible - each group internally still ranked by score.
  const sortedLeaderboard = Object.values(leaderboard).sort((a, b) => {
    const aDq = dqSet.has(a.studentRollNumber);
    const bDq = dqSet.has(b.studentRollNumber);
    if (aDq !== bDq) return aDq ? 1 : -1;
    return b.totalScore - a.totalScore;
  });

  return {
    problems: (contest.problems || []).map((p) => ({ id: p.id, title: p.title })),
    leaderboard: sortedLeaderboard.map((entry, index) => ({
      rank: index + 1,
      studentName: entry.studentName,
      studentRollNumber: entry.studentRollNumber,
      totalScore: entry.totalScore,
      scores: entry.scores,
      disqualified: dqSet.has(entry.studentRollNumber),
    })),
  };
}

module.exports = { computeLeaderboard };

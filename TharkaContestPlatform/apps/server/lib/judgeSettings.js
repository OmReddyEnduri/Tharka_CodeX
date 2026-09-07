const JudgeSettings = require("../models/JudgeSettings");

// Singleton read that creates the document with schema defaults on first
// read, so there's always something to judge against even before an admin
// has touched the settings page. Atomic upsert, not find-then-create: two
// requests racing before the doc exists would otherwise both see null and
// both try to create it, and the loser throws a duplicate-key error on the
// fixed _id - exactly the kind of thing that happens right as many lab
// laptops boot at once and hit a judge call simultaneously on a fresh
// database. findOneAndUpdate with upsert is a single atomic operation, so
// there's no window for two requests to both think they're the creator.
async function getJudgeSettings() {
  return JudgeSettings.findOneAndUpdate(
    { _id: "global" },
    {},
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

module.exports = { getJudgeSettings };

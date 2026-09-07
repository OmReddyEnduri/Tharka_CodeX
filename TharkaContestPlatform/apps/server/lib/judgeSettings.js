const JudgeSettings = require("../models/JudgeSettings");

// Singleton read, same pattern as syncRoutes.js's getOrCreateSyncState -
// creates the document with schema defaults on first read so there's always
// something to judge against, even before an admin has touched the settings
// page.
async function getJudgeSettings() {
  let settings = await JudgeSettings.findById("global");
  if (!settings) settings = await JudgeSettings.create({ _id: "global" });
  return settings;
}

module.exports = { getJudgeSettings };

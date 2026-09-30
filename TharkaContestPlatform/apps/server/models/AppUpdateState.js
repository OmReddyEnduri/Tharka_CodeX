const mongoose = require('mongoose');

// Singleton document (_id fixed to "global"), same pattern as SyncState -
// tracks the currently-published client-electron build so admin-web can show
// "what's live right now" without re-reading latest.yml off disk.
const appUpdateStateSchema = new mongoose.Schema({
  _id: { type: String, default: 'global' },
  // What electron-updater actually compares against - assigned at publish
  // time (see appUpdateRoutes.js's publishTimeVersion()), not read from the
  // build itself.
  version: { type: String },
  fileName: { type: String },
  sha512: { type: String },
  size: { type: Number },
  publishedAt: { type: Date },
});

module.exports = mongoose.model('AppUpdateState', appUpdateStateSchema);

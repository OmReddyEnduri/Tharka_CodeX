const mongoose = require('mongoose');

// Singleton document (_id fixed to "global"). One counter for the whole
// dataset is deliberate: the dataset (a handful of contests/problems) is
// small enough that a "Sync" always replaces it wholesale on the client,
// so per-entity diffing/versioning would be needless complexity.
const syncStateSchema = new mongoose.Schema({
  _id: { type: String, default: 'global' },
  version: { type: Number, default: 0 },
  lastSyncedAt: { type: Date },
});

module.exports = mongoose.model('SyncState', syncStateSchema);

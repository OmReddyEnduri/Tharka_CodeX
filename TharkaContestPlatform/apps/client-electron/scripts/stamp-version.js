// Stamps package.json's version from the current build date/time, so nobody
// has to remember to bump a version number before publishing an update -
// "version" is just an internal identifier the updater diffs, so any
// monotonically-increasing value works. Runs as part of `npm run build`
// (see the "prebuild" script), so every build is automatically newer than
// the last as long as it happens later in wall-clock time.
//
// Format: MAJOR.MINOR.PATCH where MAJOR=UTC year, MINOR=day-of-year (1-366),
// PATCH=seconds-since-midnight-UTC. All three are plain non-negative
// integers (valid semver, which electron-updater/NSIS require), and the
// triplet sorts identically to the build's real date/time - later builds
// always compare as "newer" without anyone choosing a number.
const fs = require("fs");
const path = require("path");

const pkgPath = path.join(__dirname, "..", "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

const now = new Date();
const major = now.getUTCFullYear();
const startOfYear = Date.UTC(major, 0, 1);
const dayOfYear = Math.floor((now.getTime() - startOfYear) / 86400000) + 1;
const secondsOfDay = now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds();

pkg.version = `${major}.${dayOfYear}.${secondsOfDay}`;

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
console.log(`Stamped version ${pkg.version} (build time ${now.toISOString()})`);

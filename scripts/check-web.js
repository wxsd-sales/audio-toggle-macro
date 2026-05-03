import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const requiredFiles = [
  "audio-toggle.js",
  "scripts/serve-web.js",
  "web/app.js",
  "web/index.html",
  "web/styles.css",
];

const configPattern =
  /const groups = \[[\s\S]*?\];\n\nconst applyDefaultAfterCall = [\s\S]*?;\nconst allowUserCancelDefaults = [\s\S]*?;\nconst applyDefaultDelayMinutes = [\s\S]*?;\nconst showAlertWhenApplyDefaults = [\s\S]*?;/;

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function checkSyntax(filePath) {
  const result = spawnSync(process.execPath, ["--check", filePath], {
    stdio: "inherit",
  });

  if (result.status !== 0) {
    fail(`${filePath} failed JavaScript syntax validation.`);
  }
}

for (const filePath of requiredFiles) {
  if (!existsSync(filePath)) {
    fail(`Missing required file: ${filePath}`);
  }
}

checkSyntax("web/app.js");
checkSyntax("scripts/serve-web.js");

const html = readFileSync("web/index.html", "utf8");
const macro = readFileSync("audio-toggle.js", "utf8");

if (!html.includes('src="./app.js"')) {
  fail("web/index.html must load ./app.js.");
}

if (!html.includes('href="./styles.css"')) {
  fail("web/index.html must load ./styles.css.");
}

if (!html.includes('id="buttonPreview"')) {
  fail("web/index.html must include the live control panel button preview.");
}

if (!configPattern.test(macro)) {
  fail("audio-toggle.js config block could not be identified for export.");
}

if (process.exitCode) {
  process.exit();
}

console.log("Web wizard checks passed.");

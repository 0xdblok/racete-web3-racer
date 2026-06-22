#!/usr/bin/env node

// check-token-rooms-safety.mjs
// Automated safety guardrails for Token Stake Rooms Phase B.
// Verifies disabled state, fee config, wallet addresses, mints,
// and scans for forbidden write/transfer/signer keywords in
// token-rooms related files.
//
// Exit 0 = all checks pass.  Exit 1 = one or more violations found.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const __dirname = resolve(fileURLToPath(import.meta.url), "..", "..");
const ROOT = __dirname;

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

let failures = 0;
let passed = 0;

function pass(msg) {
  passed++;
  console.log(`${GREEN}  ✓${RESET} ${msg}`);
}

function fail(msg) {
  failures++;
  console.log(`${RED}  ✗${RESET} ${msg}`);
}

function warn(msg) {
  console.log(`${YELLOW}  ⚠${RESET} ${msg}`);
}

function header(title) {
  console.log(`\n${BOLD}${title}${RESET}`);
}

function exit() {
  console.log("");
  if (failures === 0) {
    console.log(`${GREEN}${BOLD}All safety checks passed.${RESET} Token Stake Rooms are in safe disabled state.`);
    process.exit(0);
  } else {
    console.log(
      `${RED}${BOLD}${failures} safety check(s) FAILED.${RESET} Token Stake Rooms must remain disabled until resolved.`,
    );
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Config constant extraction
// ---------------------------------------------------------------------------

function readConfigText() {
  const path = join(ROOT, "src", "config", "token-rooms.ts");
  try {
    return readFileSync(path, "utf-8");
  } catch {
    fail(`Cannot read config file: ${path}`);
    return "";
  }
}

function extractConst(text, name) {
  // Match:  export const NAME = VALUE as const;
  const re = new RegExp(`export\\s+const\\s+${name}\\s*=\\s*(.+?)\\s+as\\s+const\\s*;`);
  const m = text.match(re);
  if (!m) return null;
  let raw = m[1].trim();
  // Unquote string values
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    raw = raw.slice(1, -1);
  }
  return raw;
}

function extractNumber(text, name) {
  const val = extractConst(text, name);
  if (val === null) return null;
  const num = Number(val);
  return Number.isNaN(num) ? null : num;
}

function extractObjectProp(text, objName, propName) {
  // Match object property:  propName: VALUE,
  const re = new RegExp(`${propName}\\s*:\\s*([0-9_]+)\\s*,`);
  const m = text.match(re);
  if (!m) return null;
  const num = Number(m[1].replace(/_/g, ""));
  return Number.isNaN(num) ? null : num;
}

// ---------------------------------------------------------------------------
// Forbidden keyword scanner
// ---------------------------------------------------------------------------

const FORBIDDEN_KEYWORDS = [
  "sendTransaction",
  "signTransaction",
  "signAllTransactions",
  "transferChecked",
  "createTransferInstruction",
  "createAssociatedTokenAccount",
  "getOrCreateAssociatedTokenAccount",
  "Keypair.fromSecretKey",
  "secretKey",
  "privateKey",
  "TOKEN_VAULT_PRIVATE_KEY",
  "payer",
  "sendAndConfirmTransaction",
];

const SCAN_PATHS = [
  "src/components/token-rooms",
  "src/app/api/token-rooms",
  "src/config/token-rooms.ts",
  "src/types/token-rooms.ts",
];

function listFilesRecursive(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(full));
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}

function scanFiles() {
  let allFiles = [];
  for (const scanPath of SCAN_PATHS) {
    const full = join(ROOT, scanPath);
    try {
      const st = statSync(full);
      if (st.isFile()) {
        allFiles.push(full);
      } else if (st.isDirectory()) {
        allFiles.push(...listFilesRecursive(full));
      }
    } catch {
      warn(`Path not found: ${scanPath} (skipping)`);
    }
  }

  let totalHits = 0;

  for (const file of allFiles) {
    const rel = file.replace(ROOT + "/", "");
    const content = readFileSync(file, "utf-8");

    for (const kw of FORBIDDEN_KEYWORDS) {
      if (content.includes(kw)) {
        // Count occurrences
        const hits = content.split(kw).length - 1;
        totalHits += hits;
        fail(`Forbidden keyword "${kw}" found in ${rel} (${hits} hit${hits > 1 ? "s" : ""})`);
      }
    }
  }

  if (totalHits === 0) {
    pass(`No forbidden keywords found in ${SCAN_PATHS.length} scanned paths (${allFiles.length} files)`);
  }
}

// ---------------------------------------------------------------------------
// Main check sequence
// ---------------------------------------------------------------------------

console.log(`${BOLD}Token Stake Rooms Safety Check${RESET}`);
console.log(`Root: ${ROOT}\n`);

// 1. Read config
const configText = readConfigText();
if (!configText) {
  exit();
}

// 2. Feature flags
header("Feature Flags");
const enabled = extractConst(configText, "TOKEN_STAKE_ROOMS_ENABLED");
const testMode = extractConst(configText, "TOKEN_STAKE_ROOMS_TEST_MODE");

if (enabled === "false") pass("TOKEN_STAKE_ROOMS_ENABLED = false");
else fail(`TOKEN_STAKE_ROOMS_ENABLED = ${enabled} (expected false)`);

if (testMode === "true") pass("TOKEN_STAKE_ROOMS_TEST_MODE = true");
else fail(`TOKEN_STAKE_ROOMS_TEST_MODE = ${testMode} (expected true)`);

// 3. Fee BPS sum
header("Fee Configuration");
const creatorBps = extractObjectProp(configText, "TOKEN_ROOM_FEE_BPS", "creatorFeeBps");
const weeklyBps = extractObjectProp(configText, "TOKEN_ROOM_FEE_BPS", "weeklyRewardBps");
const treasuryBps = extractObjectProp(configText, "TOKEN_ROOM_FEE_BPS", "treasuryFeeBps");
const payoutBps = extractObjectProp(configText, "TOKEN_ROOM_FEE_BPS", "playerPayoutBps");

if (creatorBps === 0) pass("creatorFeeBps = 0");
else fail(`creatorFeeBps = ${creatorBps} (expected 0)`);

if (weeklyBps === 1500) pass("weeklyRewardBps = 1500");
else fail(`weeklyRewardBps = ${weeklyBps} (expected 1500)`);

if (treasuryBps === 500) pass("treasuryFeeBps = 500");
else fail(`treasuryFeeBps = ${treasuryBps} (expected 500)`);

if (payoutBps === 8000) pass("playerPayoutBps = 8000");
else fail(`playerPayoutBps = ${payoutBps} (expected 8000)`);

const bpsSum = (creatorBps ?? 0) + (weeklyBps ?? 0) + (treasuryBps ?? 0) + (payoutBps ?? 0);
if (bpsSum === 10000) pass(`fee BPS sum = ${bpsSum} (expected 10000)`);
else fail(`fee BPS sum = ${bpsSum} (expected 10000)`);

// 4. Mint verification
header("Token Mint Configuration");
const testMint = extractConst(configText, "RACETE_TEST_TOKEN_MINT");
const prodMint = extractConst(configText, "RACETE_TOKEN_MINT");

if (testMint === "26vpJsWJswDbztCoZBEskkqjMKeFn9ym7s72Hn3spump") {
  pass("RACETE_TEST_TOKEN_MINT = 26vpJsWJswDbztCoZBEskkqjMKeFn9ym7s72Hn3spump");
} else fail(`RACETE_TEST_TOKEN_MINT = ${testMint}`);

if (prodMint === "TO_BE_PROVIDED_FINAL_PUMPFUN_MINT") {
  pass("RACETE_TOKEN_MINT = TO_BE_PROVIDED_FINAL_PUMPFUN_MINT (placeholder)");
} else fail(`RACETE_TOKEN_MINT = ${prodMint} (expected placeholder)`);

// 5. Wallet address verification
header("Wallet Configuration");
const treasury = extractConst(configText, "TOKEN_TREASURY_WALLET");
const weeklyWallet = extractConst(configText, "TOKEN_WEEKLY_REWARD_WALLET");

if (treasury === "ne8CVnmNJKuSegSLJ7PtA1zPqEKdynXSzivj4kKVXVG") {
  pass("TOKEN_TREASURY_WALLET = ne8CVnmNJKuSegSLJ7PtA1zPqEKdynXSzivj4kKVXVG");
} else fail(`TOKEN_TREASURY_WALLET = ${treasury}`);

if (weeklyWallet === "4oCUAXbyLfSzd6YifcL1QkXNqepm2cZpwxm3pqGNx6Lw") {
  pass("TOKEN_WEEKLY_REWARD_WALLET = 4oCUAXbyLfSzd6YifcL1QkXNqepm2cZpwxm3pqGNx6Lw");
} else fail(`TOKEN_WEEKLY_REWARD_WALLET = ${weeklyWallet}`);

// 6. Stake presets
header("Stake Configuration");
const minPlayers = extractNumber(configText, "TOKEN_ROOM_MIN_PLAYERS");
const maxPlayers = extractNumber(configText, "TOKEN_ROOM_MAX_PLAYERS");
const decimals = extractNumber(configText, "TOKEN_ROOM_DECIMALS");

if (minPlayers === 2) pass("TOKEN_ROOM_MIN_PLAYERS = 2");
else fail(`TOKEN_ROOM_MIN_PLAYERS = ${minPlayers} (expected 2)`);

if (maxPlayers === 6) pass("TOKEN_ROOM_MAX_PLAYERS = 6");
else fail(`TOKEN_ROOM_MAX_PLAYERS = ${maxPlayers} (expected 6)`);

if (decimals === 6) pass("TOKEN_ROOM_DECIMALS = 6");
else fail(`TOKEN_ROOM_DECIMALS = ${decimals} (expected 6)`);

// 7. Forbidden keyword scan
header("Forbidden Keyword Scan");
scanFiles();

// 8. Migration file existence
header("Migration File Check");
const migrationPath = join(ROOT, "supabase", "migrations", "20260621150000_add_token_stake_rooms_phase_a.sql");
try {
  const migrationContent = readFileSync(migrationPath, "utf-8");
  if (migrationContent.includes("create table if not exists token_rooms") || migrationContent.includes("CREATE TABLE IF NOT EXISTS token_rooms")) {
    pass(`Migration file exists: supabase/migrations/20260621150000_add_token_stake_rooms_phase_a.sql`);
  } else {
    fail("Migration file exists but does not contain expected token_rooms DDL");
  }
} catch {
  fail(`Migration file not found: supabase/migrations/20260621150000_add_token_stake_rooms_phase_a.sql`);
}

// 9. API route dry-run/disabled safety checks
header("API Dry-Run Route Check");
const apiDir = join(ROOT, "src", "app", "api", "token-rooms");
const dryRunRoutes = ["create", "join-intent"];
for (const route of dryRunRoutes) {
  const routePath = join(apiDir, route, "route.ts");
  try {
    const content = readFileSync(routePath, "utf-8");
    const hasTestModeGate = content.includes("TOKEN_STAKE_ROOMS_TEST_MODE") && content.includes("tokenRoomDryRunUnavailableResponse");
    const hasDryRunNotice = content.includes("No RACETE deposit was requested or transferred") || content.includes("dry-run");
    const avoidsTokenDepositTable = !content.includes('.from("token_deposits")') && !content.includes(".from('token_deposits')");
    if (hasTestModeGate && hasDryRunNotice && avoidsTokenDepositTable) {
      pass(`POST /api/token-rooms/${route} is test-mode dry-run only`);
    } else {
      fail(`POST /api/token-rooms/${route} missing dry-run safety gate/notice or writes token_deposits`);
    }
  } catch {
    fail(`Route file not found: src/app/api/token-rooms/${route}/route.ts`);
  }
}

const disabledRoutes = ["confirm-deposit", "refund"];
for (const route of disabledRoutes) {
  const routePath = join(apiDir, route, "route.ts");
  try {
    const content = readFileSync(routePath, "utf-8");
    if (content.includes("tokenRoomDisabledResponse")) {
      pass(`POST /api/token-rooms/${route} remains disabled`);
    } else {
      fail(`POST /api/token-rooms/${route} does NOT use tokenRoomDisabledResponse`);
    }
  } catch {
    fail(`Route file not found: src/app/api/token-rooms/${route}/route.ts`);
  }
}

header("No SPL Transaction Import Check");
const tokenRoomApiDir = join(ROOT, "src", "app", "api", "token-rooms");
const tokenRoomUiDir = join(ROOT, "src", "components", "token-rooms");
let unsafeImportHits = 0;
for (const dir of [tokenRoomApiDir, tokenRoomUiDir]) {
  for (const file of listFilesRecursive(dir)) {
    const rel = file.replace(ROOT + "/", "");
    const content = readFileSync(file, "utf-8");
    if (content.includes("@solana/spl-token") || content.includes("TransactionInstruction") || content.includes("VersionedTransaction")) {
      unsafeImportHits++;
      fail(`Potential transaction/SPL helper import found in ${rel}`);
    }
  }
}
if (unsafeImportHits === 0) pass("No SPL token transfer or transaction helper imports in token-room API/UI files");

// 10. UI warning text present
header("UI Warning Text Check");
const previewPath = join(ROOT, "src", "components", "token-rooms", "TokenStakeRoomsPreview.tsx");
try {
  const previewContent = readFileSync(previewPath, "utf-8");
  if (previewContent.includes("Production token rooms are not live")) {
    pass("TokenStakeRoomsPreview contains test-only warning text");
  } else {
    fail("TokenStakeRoomsPreview missing test-only warning text");
  }
} catch {
  fail("TokenStakeRoomsPreview component not found");
}

// 11. Package scripts present
header("Package Script Check");
const pkgPath = join(ROOT, "package.json");
try {
  const pkgContent = readFileSync(pkgPath, "utf-8");
  const pkg = JSON.parse(pkgContent);
  if (pkg.scripts && pkg.scripts["check:token-rooms"]) {
    pass('"check:token-rooms" script exists in package.json');
  } else {
    fail('"check:token-rooms" script missing from package.json');
  }
  if (pkg.scripts && pkg.scripts["check:token-rooms-safety"]) {
    pass('"check:token-rooms-safety" script exists in package.json');
  } else {
    fail('"check:token-rooms-safety" script missing from package.json');
  }
} catch {
  fail("Cannot read or parse package.json");
}

// 12. Done
exit();

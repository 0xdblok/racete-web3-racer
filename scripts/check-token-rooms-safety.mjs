#!/usr/bin/env node

// Token Stake Rooms Phase C.3 safety guardrails.
// Allows frontend user-signed Token-2022 deposits and server-only payout execution
// from the configured vault signer route/module only. Blocks client private-key
// exposure, config/economics drift, global-vault-balance settlement math, and
// unsafe payout paths.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(import.meta.url), "..", "..");
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
let failures = 0;
let passed = 0;

function pass(msg) { passed++; console.log(`${GREEN}  ✓${RESET} ${msg}`); }
function fail(msg) { failures++; console.log(`${RED}  ✗${RESET} ${msg}`); }
function header(title) { console.log(`\n${BOLD}${title}${RESET}`); }
function read(path) { return readFileSync(join(ROOT, path), "utf-8"); }
function existsFile(path) { try { return statSync(join(ROOT, path)).isFile(); } catch { return false; } }
function listFilesRecursive(dir) {
  const full = join(ROOT, dir);
  let files = [];
  for (const entry of readdirSync(full, { withFileTypes: true })) {
    const rel = join(dir, entry.name);
    if (entry.isDirectory()) files = files.concat(listFilesRecursive(rel));
    else if (entry.isFile()) files.push(rel);
  }
  return files;
}
function includesAny(text, terms) { return terms.some((term) => text.includes(term)); }
function extractConst(text, name) {
  const m = text.match(new RegExp(`export\\s+const\\s+${name}\\s*=\\s*(.+?)\\s+as\\s+const\\s*;`));
  if (!m) return null;
  const raw = m[1].trim();
  return raw.replace(/^['"]|['"]$/g, "");
}
function extractObjectProp(text, propName) {
  const m = text.match(new RegExp(`${propName}\\s*:\\s*([0-9_]+)\\s*,`));
  return m ? Number(m[1].replace(/_/g, "")) : null;
}
function assertContains(file, text, term, msg) { text.includes(term) ? pass(msg) : fail(`${msg} missing (${file}: ${term})`); }
function assertNotContains(file, text, term, msg) { text.includes(term) ? fail(`${msg} found in ${file}`) : pass(msg); }
function exit() {
  console.log(`\n${passed} passed, ${failures} failed.`);
  if (failures) process.exit(1);
  console.log(`${GREEN}${BOLD}All safety checks passed.${RESET} Token Stake Rooms Phase C.3 settlement/payout boundaries are intact.`);
}

console.log(`${BOLD}Token Stake Rooms Phase C.3 Safety Check${RESET}`);
console.log(`Root: ${ROOT}\n`);

const config = read("src/config/token-rooms.ts");

header("Feature flags and constants");
extractConst(config, "TOKEN_STAKE_ROOMS_ENABLED") === "false" ? pass("TOKEN_STAKE_ROOMS_ENABLED remains false") : fail("TOKEN_STAKE_ROOMS_ENABLED must remain false");
extractConst(config, "TOKEN_STAKE_ROOMS_TEST_MODE") === "true" ? pass("TOKEN_STAKE_ROOMS_TEST_MODE remains true") : fail("TOKEN_STAKE_ROOMS_TEST_MODE must remain true");
extractConst(config, "RACETE_TEST_TOKEN_MINT") === "26vpJsWJswDbztCoZBEskkqjMKeFn9ym7s72Hn3spump" ? pass("RACETE_TEST_TOKEN_MINT unchanged") : fail("RACETE_TEST_TOKEN_MINT changed");
extractConst(config, "RACETE_TOKEN_MINT") === "TO_BE_PROVIDED_FINAL_PUMPFUN_MINT" ? pass("production mint remains placeholder") : fail("production mint must remain placeholder");
extractConst(config, "TOKEN_ROOM_DEPOSIT_WALLET") === "FxDUd2EgPDLtDgCeko18VyrLJ8eAviN96NHcyDbYt18" ? pass("deposit vault wallet unchanged") : fail("deposit vault wallet changed");
extractConst(config, "TOKEN_TREASURY_WALLET") === "ne8CVnmNJKuSegSLJ7PtA1zPqEKdynXSzivj4kKVXVG" ? pass("treasury wallet unchanged") : fail("treasury wallet changed");
extractConst(config, "TOKEN_WEEKLY_REWARD_WALLET") === "4oCUAXbyLfSzd6YifcL1QkXNqepm2cZpwxm3pqGNx6Lw" ? pass("weekly wallet unchanged") : fail("weekly wallet changed");
extractConst(config, "TOKEN_2022_PROGRAM_ID") === "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb" ? pass("Token-2022 program id configured") : fail("Token-2022 program id missing/wrong");
config.includes("getTokenRoomVaultPrivateKeyBase64") && config.includes("TOKEN_ROOM_VAULT_PRIVATE_KEY_BASE64") ? pass("server-only vault private-key helper exists") : fail("vault private-key helper missing");

header("Economics");
const creator = extractObjectProp(config, "creatorFeeBps");
const weekly = extractObjectProp(config, "weeklyRewardBps");
const treasury = extractObjectProp(config, "treasuryFeeBps");
const payout = extractObjectProp(config, "playerPayoutBps");
creator === 0 ? pass("creator fee 0 bps") : fail("creator fee changed");
weekly === 1500 ? pass("weekly pool 1500 bps") : fail("weekly pool changed");
treasury === 500 ? pass("treasury fee 500 bps") : fail("treasury fee changed");
payout === 8000 ? pass("player payout pool 8000 bps") : fail("player payout pool changed");
creator + weekly + treasury + payout === 10000 ? pass("fee bps sum 10000") : fail("fee bps sum invalid");
config.includes("threeOrMoreValidFinishers") && config.includes("6_500") && config.includes("2_500") && config.includes("1_000") ? pass("3+ finisher split remains 65/25/10") : fail("3+ finisher split changed");
config.includes("twoValidFinishers") && config.includes("7_500") ? pass("2-finisher split remains 75/25") : fail("2-finisher split changed");
config.includes("oneValidFinisher") && config.includes("10_000") ? pass("1-finisher split remains 100%") : fail("1-finisher split changed");

header("Migration checks");
const phaseAMigration = "supabase/migrations/20260621150000_add_token_stake_rooms_phase_a.sql";
const c2Migration = "supabase/migrations/20260622190000_add_token_room_deposit_ledger_fields.sql";
const c3Migration = "supabase/migrations/20260622203000_add_token_room_auto_settlement.sql";
existsFile(phaseAMigration) ? pass("Phase A token-room migration exists") : fail("Phase A migration missing");
existsFile(c2Migration) ? pass("Phase C.2 deposit ledger migration exists") : fail("Phase C.2 deposit ledger migration missing");
if (existsFile(c3Migration)) {
  const migration = read(c3Migration);
  assertContains(c3Migration, migration, "settlement_lock_id", "settlement lock column/index migration present");
  assertContains(c3Migration, migration, "payout_type", "payout_type migration present");
  assertContains(c3Migration, migration, "token_payouts_tx_signature_unique", "payout signature uniqueness present");
  assertContains(c3Migration, migration, "token_payouts_room_type_recipient_rank_unique", "room/type/recipient/rank uniqueness present");
  assertContains(c3Migration, migration, "results_recorded", "results_recorded status allowed");
  assertContains(c3Migration, migration, "manual_review", "manual_review status allowed");
} else fail("Phase C.3 auto-settlement migration missing");

header("Private-key exposure checks");
const envExample = read(".env.example");
const serverEnvExample = read("server/.env.example");
assertContains(".env.example", envExample, "TOKEN_ROOM_VAULT_PRIVATE_KEY_BASE64=", "root env example contains placeholder only");
assertContains("server/.env.example", serverEnvExample, "TOKEN_ROOM_VAULT_PRIVATE_KEY_BASE64=", "server env example contains placeholder only");
assertNotContains(".env.example", envExample, "NEXT_PUBLIC_TOKEN_ROOM_VAULT_PRIVATE_KEY", "private key is not NEXT_PUBLIC in root env example");
assertNotContains("server/.env.example", serverEnvExample, "NEXT_PUBLIC_TOKEN_ROOM_VAULT_PRIVATE_KEY", "private key is not NEXT_PUBLIC in server env example");
const clientFiles = [
  ...listFilesRecursive("src/components/token-rooms"),
  "src/components/race/MultiplayerRaceClient.tsx",
];
let clientPrivateKeyHits = 0;
for (const file of clientFiles) {
  const text = read(file);
  if (text.includes("TOKEN_ROOM_VAULT_PRIVATE_KEY_BASE64") || text.includes("Keypair.fromSecretKey") || text.includes("secretKey")) {
    fail(`client private-key exposure in ${file}`);
    clientPrivateKeyHits++;
  }
}
if (clientPrivateKeyHits === 0) pass("no vault private-key references in client UI files");

header("Deposit verification boundary");
const depositIntent = read("src/app/api/token-rooms/deposit-intent/route.ts");
const confirmDeposit = read("src/app/api/token-rooms/confirm-deposit/route.ts");
assertContains("deposit-intent", depositIntent, "Wallet is not a member", "deposit-intent rejects non-member wallets");
assertContains("confirm-deposit", confirmDeposit, "Transaction signature has already been used", "confirm-deposit rejects reused signatures");
assertContains("confirm-deposit", confirmDeposit, "amount !== expectedAmount", "confirm-deposit exact amount validation exists");
assertContains("confirm-deposit", confirmDeposit, "destinationParsed.owner !== depositWallet", "confirm-deposit validates vault token account owner");
assertContains("confirm-deposit", confirmDeposit, "postDestination - preDestination !== expectedAmount", "confirm-deposit validates destination exact delta");
assertContains("confirm-deposit", confirmDeposit, "room_id: room.roomId", "confirm-deposit writes room-scoped deposit ledger");

header("Settlement/payout API checks");
const settlement = read("src/app/api/token-rooms/_settlement.ts");
const recordResult = read("src/app/api/token-rooms/[id]/record-result/route.ts");
const settleRoute = read("src/app/api/token-rooms/[id]/settle-and-payout/route.ts");
const settlementGet = read("src/app/api/token-rooms/[id]/settlement/route.ts");
assertContains("_settlement", settlement, ".from(\"token_deposits\")", "settlement queries token_deposits");
assertContains("_settlement", settlement, ".eq(\"room_id\", roomId)", "settlement filters deposits by room_id");
assertContains("_settlement", settlement, "amount_base_units", "settlement uses base-unit amounts");
assertContains("_settlement", settlement, "getPlayerPayoutSplit", "settlement uses configured payout split");
assertContains("_settlement", settlement, "No valid finishers", "settlement blocks all-DNF/DQ automatic payout");
assertContains("_settlement", settlement, "final_race_status", "settlement reads result status");
assertContains("_settlement", settlement, "manual_review", "settlement supports manual review");
assertContains("_settlement", settlement, "Keypair.fromSecretKey", "server-only vault signer is used in settlement module");
assertContains("_settlement", settlement, "signer.publicKey.toBase58() !== expectedVault", "vault signer public key is validated against deposit wallet");
assertContains("_settlement", settlement, "sendAndConfirmTransaction", "payout execution confirms on-chain transactions");
assertContains("_settlement", settlement, "createTransferCheckedInstruction", "payout uses Token-2022 transferChecked");
assertContains("_settlement", settlement, "TOKEN_2022_PROGRAM_ID", "payout uses Token-2022 program id");
assertContains("record-result", recordResult, "finishStatus", "record-result validates finish statuses");
assertContains("record-result", recordResult, "finishStatus === \"finished\"", "record-result excludes non-finishers from payout eligibility");
assertContains("record-result", recordResult, "No valid finishers", "record-result marks all-DNF/DQ for manual review");
assertContains("settle route", settleRoute, "settlement_lock_id", "settle-and-payout uses settlement lock");
assertContains("settle route", settleRoute, "existingPayouts.some", "settle-and-payout rejects duplicate paid settlement");
assertContains("settle route", settleRoute, "loadVaultSigner", "settle-and-payout requires server signer");
assertContains("settlement GET", settlementGet, "settlementPreview", "settlement GET returns preview");

header("Restricted server-side transfer allowance");
const serverFiles = listFilesRecursive("src/app/api/token-rooms");
const allowedPayoutFile = "src/app/api/token-rooms/_settlement.ts";
let badServerHits = 0;
for (const file of serverFiles) {
  const text = read(file);
  const hasTransfer = includesAny(text, ["sendAndConfirmTransaction", "createTransferCheckedInstruction", "createAssociatedTokenAccountInstruction", "Keypair.fromSecretKey"]);
  if (hasTransfer && file !== allowedPayoutFile) {
    fail(`server transfer/signer helper outside allowed payout module: ${file}`);
    badServerHits++;
  }
  if (text.includes("TOKEN_ROOM_VAULT_PRIVATE_KEY_BASE64") && file !== allowedPayoutFile && file !== "src/config/token-rooms.ts") {
    fail(`vault private-key env referenced outside allowed server config/settlement: ${file}`);
    badServerHits++;
  }
}
if (badServerHits === 0) pass("server-side signer/transfer helpers restricted to settlement module");
assertNotContains("_settlement", settlement, "console.log", "settlement module does not console.log secrets/data");
assertNotContains("_settlement", settlement, "console.warn", "settlement module does not console.warn secrets/data");

header("Frontend transaction boundary");
const lobby = read("src/components/token-rooms/TokenRoomDryRunLobbyClient.tsx");
lobby.includes("createTransferCheckedInstruction") && lobby.includes("TOKEN_2022_PROGRAM_ID") ? pass("frontend still builds Token-2022 user-signed deposits") : fail("frontend Token-2022 deposit missing");
lobby.includes("sendTransaction(transaction, connection)") ? pass("frontend deposits use connected wallet adapter") : fail("frontend wallet sendTransaction missing");
includesAny(lobby, ["createApproveInstruction", "createApproveCheckedInstruction", "approveChecked(", "delegate:"]) ? fail("frontend must not request approvals/delegate authority") : pass("frontend does not request approval/delegate authority");
lobby.includes("automatic payouts") && lobby.includes("settlement") ? pass("UI exposes automatic settlement status") : fail("UI settlement status missing");

header("Package scripts");
const pkg = JSON.parse(read("package.json"));
pkg.scripts?.["check:token-rooms-safety"] ? pass("check:token-rooms-safety script exists") : fail("check:token-rooms-safety missing");
pkg.scripts?.["check:token-rooms"] ? pass("check:token-rooms script exists") : fail("check:token-rooms missing");

exit();

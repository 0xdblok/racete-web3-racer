#!/usr/bin/env node

// Token Stake Rooms Phase C.2 safety guardrails.
// Allows frontend user-signed Token-2022 deposit transactions only.
// Blocks server-side private keys, server-side token transfers, payout/refund writes,
// automatic treasury/weekly/winner transfer logic, and unsafe config changes.

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
function exit() {
  console.log(`\n${passed} passed, ${failures} failed.`);
  if (failures) process.exit(1);
  console.log(`${GREEN}${BOLD}All safety checks passed.${RESET} Token Stake Rooms Phase C.2 deposit flow remains payout-disabled.`);
}

console.log(`${BOLD}Token Stake Rooms Phase C.2 Safety Check${RESET}`);
console.log(`Root: ${ROOT}\n`);

const config = read("src/config/token-rooms.ts");

header("Feature flags and constants");
extractConst(config, "TOKEN_STAKE_ROOMS_ENABLED") === "false" ? pass("TOKEN_STAKE_ROOMS_ENABLED remains false") : fail("TOKEN_STAKE_ROOMS_ENABLED must remain false");
extractConst(config, "TOKEN_STAKE_ROOMS_TEST_MODE") === "true" ? pass("TOKEN_STAKE_ROOMS_TEST_MODE remains true") : fail("TOKEN_STAKE_ROOMS_TEST_MODE must remain true");
extractConst(config, "RACETE_TEST_TOKEN_MINT") === "26vpJsWJswDbztCoZBEskkqjMKeFn9ym7s72Hn3spump" ? pass("RACETE_TEST_TOKEN_MINT unchanged") : fail("RACETE_TEST_TOKEN_MINT changed");
extractConst(config, "RACETE_TOKEN_MINT") === "TO_BE_PROVIDED_FINAL_PUMPFUN_MINT" ? pass("production mint remains placeholder") : fail("production mint must remain placeholder");
extractConst(config, "TOKEN_TREASURY_WALLET") === "ne8CVnmNJKuSegSLJ7PtA1zPqEKdynXSzivj4kKVXVG" ? pass("treasury wallet unchanged") : fail("treasury wallet changed");
extractConst(config, "TOKEN_WEEKLY_REWARD_WALLET") === "4oCUAXbyLfSzd6YifcL1QkXNqepm2cZpwxm3pqGNx6Lw" ? pass("weekly wallet unchanged") : fail("weekly wallet changed");
extractConst(config, "TOKEN_2022_PROGRAM_ID") === "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb" ? pass("Token-2022 program id configured") : fail("Token-2022 program id missing/wrong");
config.includes("getTokenRoomDepositWallet") && config.includes("TOKEN_ROOM_DEPOSIT_WALLET") ? pass("public deposit wallet env helper exists") : fail("TOKEN_ROOM_DEPOSIT_WALLET helper missing");

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

header("Migration checks");
const phaseAMigration = "supabase/migrations/20260621150000_add_token_stake_rooms_phase_a.sql";
const c2Migration = "supabase/migrations/20260622190000_add_token_room_deposit_ledger_fields.sql";
existsFile(phaseAMigration) ? pass("Phase A token-room migration exists") : fail("Phase A migration missing");
if (existsFile(c2Migration)) {
  const migration = read(c2Migration);
  migration.includes("token_deposits_tx_signature_unique") && migration.includes("tx_signature") ? pass("token_deposits tx_signature unique index exists") : fail("tx_signature unique index missing");
  migration.includes("token_deposits_room_wallet_confirmed_unique") ? pass("room+wallet confirmed deposit uniqueness exists") : fail("room+wallet confirmed uniqueness missing");
  migration.includes("deposit_wallet") && migration.includes("token_program") && migration.includes("amount_base_units") ? pass("deposit ledger columns present") : fail("deposit ledger required columns missing");
} else fail("Phase C.2 deposit ledger migration missing");

header("API route checks");
const depositIntent = read("src/app/api/token-rooms/deposit-intent/route.ts");
const confirmDeposit = read("src/app/api/token-rooms/confirm-deposit/route.ts");
const refundRoute = read("src/app/api/token-rooms/refund/route.ts");
const startRoute = read("src/app/api/token-rooms/[id]/start-dry-run/route.ts");
depositIntent.includes("roomId") && depositIntent.includes("walletAddress") && depositIntent.includes("depositWallet") && depositIntent.includes("amountBaseUnits") ? pass("deposit-intent returns room/wallet/amount/deposit wallet") : fail("deposit-intent missing required fields");
depositIntent.includes("Wallet is not a member") ? pass("deposit-intent rejects non-member wallets") : fail("deposit-intent must reject non-members");
confirmDeposit.includes("roomId is required") && confirmDeposit.includes("Valid walletAddress is required") ? pass("confirm-deposit validates roomId and walletAddress") : fail("confirm-deposit missing room/wallet validation");
confirmDeposit.includes("Transaction signature has already been used") && confirmDeposit.includes("tx_signature") ? pass("confirm-deposit rejects reused signatures") : fail("confirm-deposit reused-signature check missing");
confirmDeposit.includes("amount !== expectedAmount") && confirmDeposit.includes("No exact Token-2022 RACETE transfer") ? pass("confirm-deposit requires exact stake amount") : fail("confirm-deposit exact amount validation missing");
confirmDeposit.includes("destinationParsed.owner !== depositWallet") ? pass("confirm-deposit validates vault token account owner") : fail("confirm-deposit destination owner validation missing");
confirmDeposit.includes("postDestination - preDestination !== expectedAmount") ? pass("confirm-deposit validates destination received exact delta") : fail("confirm-deposit destination delta validation missing");
confirmDeposit.includes('.from("token_deposits")') && confirmDeposit.includes("room_id: room.roomId") && confirmDeposit.includes("wallet_address: walletAddress") ? pass("confirm-deposit writes per-room/per-player token_deposits ledger") : fail("confirm-deposit ledger insert missing room/player linkage");
refundRoute.includes("tokenRoomDisabledResponse") ? pass("refund route remains disabled") : fail("refund route must remain disabled");
startRoute.includes("allDepositsConfirmed") || startRoute.includes("ready_to_race") ? pass("race handoff requires confirmed deposits") : fail("start-dry-run must require confirmed deposits");

header("No server-side token movement / private keys / payouts");
const serverFiles = listFilesRecursive("src/app/api/token-rooms");
const serverForbidden = ["Keypair.fromSecretKey", "TOKEN_ROOM_PRIVATE_KEY", "TOKEN_VAULT_AUTHORITY_PRIVATE_KEY", "secretKey", "privateKey", "sendAndConfirmTransaction", "createTransferInstruction", "createTransferCheckedInstruction", "createAssociatedTokenAccountInstruction", "getOrCreateAssociatedTokenAccount"];
let serverHits = 0;
for (const file of serverFiles) {
  const text = read(file);
  for (const term of serverForbidden) {
    if (text.includes(term)) { fail(`server forbidden term ${term} in ${file}`); serverHits++; }
  }
  if ((text.includes('.from("token_payouts")') || text.includes(".from('token_payouts')")) && text.includes("insert")) { fail(`token_payouts write in ${file}`); serverHits++; }
  if ((text.includes('.from("token_refunds")') || text.includes(".from('token_refunds')")) && text.includes("insert")) { fail(`token_refunds write in ${file}`); serverHits++; }
}
if (serverHits === 0) pass("no server-side private key, SPL transfer helper, payout write, or refund write in token-room APIs");

header("Frontend deposit transaction boundary");
const lobby = read("src/components/token-rooms/TokenRoomDryRunLobbyClient.tsx");
lobby.includes("createTransferCheckedInstruction") && lobby.includes("TOKEN_2022_PROGRAM_ID") ? pass("frontend builds Token-2022 user-signed transferChecked deposit") : fail("frontend Token-2022 transferChecked deposit missing");
lobby.includes("sendTransaction(transaction, connection)") ? pass("frontend sends transaction via connected wallet adapter") : fail("frontend wallet sendTransaction missing");
lobby.includes("/api/token-rooms/confirm-deposit") && lobby.includes("txSignature") ? pass("frontend auto-confirms deposit with returned signature") : fail("frontend confirm-deposit call missing");
includesAny(lobby, ["createApproveInstruction", "createApproveCheckedInstruction", "approveChecked(", "delegate:"]) ? fail("frontend must not request approvals/delegate authority") : pass("frontend does not request approval/delegate authority");

header("Package scripts");
const pkg = JSON.parse(read("package.json"));
pkg.scripts?.["check:token-rooms-safety"] ? pass("check:token-rooms-safety script exists") : fail("check:token-rooms-safety missing");
pkg.scripts?.["check:token-rooms"] ? pass("check:token-rooms script exists") : fail("check:token-rooms missing");

exit();

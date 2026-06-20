import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Connection, ParsedInstruction, PartiallyDecodedInstruction, PublicKey } from "@solana/web3.js";
import { serverEnv } from "@/lib/server-env";

const TOKEN_PROGRAM_IDS = new Set([TOKEN_PROGRAM_ID.toBase58(), TOKEN_2022_PROGRAM_ID.toBase58()]);

export function isValidSolanaAddress(address: string) {
  try {
    const key = new PublicKey(address);
    return PublicKey.isOnCurve(key.toBytes()) || key.toBase58() === address;
  } catch {
    return false;
  }
}

export function tokenAmountToRaw(amount: number | string, decimals: number) {
  const value = String(amount);
  const [whole, fraction = ""] = value.split(".");
  const normalizedFraction = fraction.padEnd(decimals, "0").slice(0, decimals);
  return BigInt(whole || "0") * BigInt(10) ** BigInt(decimals) + BigInt(normalizedFraction || "0");
}

type VerifiedTokenTransfer = {
  signature: string;
  senderWallet: string;
  recipientWallet: string;
  tokenMint: string;
  rawAmount: string;
};

type ParsedTokenTransfer = {
  authority?: string;
  destination?: string;
  mint?: string;
  source?: string;
  amount?: string;
  tokenAmount?: { amount?: string; decimals?: number };
};

function parsedInstructions(instructions: (ParsedInstruction | PartiallyDecodedInstruction)[]) {
  return instructions.filter((instruction): instruction is ParsedInstruction => "parsed" in instruction);
}

async function tokenAccountOwner(connection: Connection, tokenAccount: string) {
  const account = await connection.getParsedAccountInfo(new PublicKey(tokenAccount), "confirmed");
  const data = account.value?.data;
  if (!data || typeof data === "string" || !("parsed" in data)) return null;

  const parsed = data.parsed as { info?: { owner?: string; mint?: string } };
  return parsed.info || null;
}

export async function verifyTokenTransferSignature(input: {
  signature: string;
  walletAddress: string;
  expectedTokenAmount: number | string;
}) : Promise<VerifiedTokenTransfer> {
  if (!serverEnv.tokenMint || !serverEnv.treasuryWallet) {
    throw new Error("Token payment environment is not configured");
  }

  const connection = new Connection(serverEnv.solanaRpc, "confirmed");
  const expectedRawAmount = tokenAmountToRaw(input.expectedTokenAmount, serverEnv.tokenDecimals).toString();

  const transaction = await connection.getParsedTransaction(input.signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });

  if (!transaction) throw new Error("Transaction not found or not confirmed");
  if (transaction.meta?.err) throw new Error("Transaction failed on-chain");

  const topLevel = parsedInstructions(transaction.transaction.message.instructions);
  const inner = (transaction.meta?.innerInstructions || []).flatMap((group) => parsedInstructions(group.instructions));
  const instructions = [...topLevel, ...inner];

  for (const instruction of instructions) {
    if (!TOKEN_PROGRAM_IDS.has(instruction.programId.toBase58())) continue;

    const parsed = instruction.parsed as { type?: string; info?: ParsedTokenTransfer };
    if (parsed.type !== "transferChecked" && parsed.type !== "transfer") continue;

    const info = parsed.info || {};
    const mint = info.mint || null;
    const rawAmount = info.tokenAmount?.amount || info.amount || "";
    const authority = info.authority || "";
    const destination = info.destination || "";

    if (!destination || !rawAmount) continue;
    if (mint && mint !== serverEnv.tokenMint) continue;
    if (authority !== input.walletAddress) continue;
    if (rawAmount !== expectedRawAmount) continue;

    const destinationInfo = await tokenAccountOwner(connection, destination);
    if (!destinationInfo || destinationInfo.owner !== serverEnv.treasuryWallet) continue;
    if (destinationInfo.mint && destinationInfo.mint !== serverEnv.tokenMint) continue;

    if (!mint) {
      const sourceInfo = info.source ? await tokenAccountOwner(connection, info.source) : null;
      if (!sourceInfo || sourceInfo.mint !== serverEnv.tokenMint) continue;
    }

    return {
      signature: input.signature,
      senderWallet: authority,
      recipientWallet: destinationInfo.owner,
      tokenMint: serverEnv.tokenMint,
      rawAmount,
    };
  }

  throw new Error("Matching SPL token transfer not found");
}

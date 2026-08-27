import * as fs from "node:fs";
import * as path from "node:path";
import { initialize, type ComputationResult, type Proof, type ZoKratesProvider } from "zokrates-js";

const CIRCUITS_BUILD_DIR = path.join(__dirname, "..", "..", "circuits", "build");

export interface TransferInputs {
  senderBalanceBefore: bigint;
  amount: bigint;
  senderBalanceAfter: bigint;
  recipientBalanceBefore: bigint;
  recipientBalanceAfter: bigint;
}

let providerPromise: Promise<ZoKratesProvider> | null = null;
function getProvider(): Promise<ZoKratesProvider> {
  if (!providerPromise) providerPromise = initialize();
  return providerPromise;
}

function loadCircuitArtifacts() {
  const program = fs.readFileSync(path.join(CIRCUITS_BUILD_DIR, "program"));
  const abi = JSON.parse(fs.readFileSync(path.join(CIRCUITS_BUILD_DIR, "abi.json"), "utf8"));
  const provingKey = fs.readFileSync(path.join(CIRCUITS_BUILD_DIR, "proving.key"));
  return { program: new Uint8Array(program), abi, provingKey: new Uint8Array(provingKey) };
}

/**
 * Computes a witness and generates a Groth16 proof for a single transfer
 * step. Throws if the inputs don't satisfy the circuit's constraints (e.g.
 * insufficient balance, or the balances don't conserve value) — in that
 * case no valid proof exists, so there is nothing to generate.
 *
 * Requires `npm run compile:zk` (zk/circuits) to have been run first, so
 * `zk/circuits/build/` exists.
 */
export async function generateTransferProof(inputs: TransferInputs): Promise<Proof> {
  if (!fs.existsSync(CIRCUITS_BUILD_DIR)) {
    throw new Error(
      `zk/circuits/build not found — run \`npm run compile:zk\` first (looked in ${CIRCUITS_BUILD_DIR})`
    );
  }

  const zokratesProvider = await getProvider();
  const { program, abi, provingKey } = loadCircuitArtifacts();
  const artifacts = { program, abi };

  const args = [
    inputs.senderBalanceBefore,
    inputs.amount,
    inputs.senderBalanceAfter,
    inputs.recipientBalanceBefore,
    inputs.recipientBalanceAfter,
  ].map((n) => n.toString());

  const { witness }: ComputationResult = zokratesProvider.computeWitness(artifacts, args);
  return zokratesProvider.generateProof(artifacts.program, witness, provingKey);
}

export interface SolidityProofCall {
  proof: {
    a: [bigint, bigint];
    b: [[bigint, bigint], [bigint, bigint]];
    c: [bigint, bigint];
  };
  input: bigint[];
}

/** Converts a ZoKrates proof into the shape the generated Verifier contract's `verifyTx` expects. */
export function formatProofForContract(proof: Proof): SolidityProofCall {
  const raw = proof.proof as {
    a: [string, string];
    b: [[string, string], [string, string]];
    c: [string, string];
  };
  const [ax, ay] = raw.a;
  const [[bx0, bx1], [by0, by1]] = raw.b;
  const [cx, cy] = raw.c;

  return {
    proof: {
      a: [BigInt(ax), BigInt(ay)],
      b: [
        [BigInt(bx0), BigInt(bx1)],
        [BigInt(by0), BigInt(by1)],
      ],
      c: [BigInt(cx), BigInt(cy)],
    },
    input: proof.inputs.map((hex) => BigInt(hex)),
  };
}

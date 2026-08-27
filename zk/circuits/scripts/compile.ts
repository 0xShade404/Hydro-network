import * as fs from "node:fs";
import * as path from "node:path";
import { initialize } from "zokrates-js";

/**
 * Compiles zk/circuits/src/transferValidity.zok, runs a local (non-ceremony)
 * Groth16 setup, and writes:
 *
 *   - zk/circuits/build/program        (compiled circuit, binary)
 *   - zk/circuits/build/abi.json       (circuit ABI)
 *   - zk/circuits/build/proving.key    (binary)
 *   - zk/circuits/build/verifying.key.json
 *   - zk/verifier/contracts/TransferValidityVerifier.sol (generated Solidity verifier)
 *
 * SECURITY: `zokratesProvider.setup()` runs entirely locally, with no
 * multi-party trusted-setup ceremony. Whoever runs this script has the
 * "toxic waste" needed to forge proofs for this circuit. This is fine for
 * development and demonstrating the pipeline; the resulting proving/
 * verifying keys must never be used to secure real value. A production
 * deployment needs a real ceremony (e.g. Powers of Tau + circuit-specific
 * phase 2) or a universal setup, run once and then treated as fixed.
 */

const CIRCUITS_DIR = path.join(__dirname, "..");
const BUILD_DIR = path.join(CIRCUITS_DIR, "build");
const VERIFIER_CONTRACTS_DIR = path.join(CIRCUITS_DIR, "..", "verifier", "contracts");

async function main() {
  const zokratesProvider = await initialize();

  const source = fs.readFileSync(path.join(CIRCUITS_DIR, "src", "transferValidity.zok"), "utf8");
  const artifacts = zokratesProvider.compile(source);
  console.log(`compiled transferValidity.zok (${artifacts.constraintCount} constraints)`);

  const keypair = zokratesProvider.setup(artifacts.program);
  console.log("ran local (non-ceremony) Groth16 setup — see the warning in this script's header");

  fs.mkdirSync(BUILD_DIR, { recursive: true });
  fs.writeFileSync(path.join(BUILD_DIR, "program"), Buffer.from(artifacts.program));
  fs.writeFileSync(path.join(BUILD_DIR, "abi.json"), JSON.stringify(artifacts.abi, null, 2));
  fs.writeFileSync(path.join(BUILD_DIR, "proving.key"), Buffer.from(keypair.pk));
  fs.writeFileSync(path.join(BUILD_DIR, "verifying.key.json"), JSON.stringify(keypair.vk, null, 2));
  console.log(`wrote circuit artifacts to ${path.relative(process.cwd(), BUILD_DIR)}`);

  const verifierSource = zokratesProvider.exportSolidityVerifier(keypair.vk);
  fs.mkdirSync(VERIFIER_CONTRACTS_DIR, { recursive: true });
  const verifierPath = path.join(VERIFIER_CONTRACTS_DIR, "TransferValidityVerifier.sol");
  fs.writeFileSync(verifierPath, verifierSource);
  console.log(`wrote generated verifier to ${path.relative(process.cwd(), verifierPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

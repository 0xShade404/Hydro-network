import * as fs from "node:fs";
import * as path from "node:path";
import solc from "solc";

/**
 * Compiles contracts/HydroSettlement.sol with the npm-installed `solc`
 * package — same reason as contracts/token and zk/verifier: Hardhat's own
 * compiler downloader is blocked by this environment's network policy.
 *
 * HydroSettlement.sol imports "./TransferValidityVerifier.sol", the
 * generated verifier from zk/circuits' compile step. Rather than resolve
 * that as a cross-package relative import (solc's import-callback
 * resolution rules for that are finicky to get right — see the comment
 * below), this script just reads the file from zk/verifier/contracts and
 * injects it into the same in-memory sources map under the matching key,
 * so solc resolves it exactly like a same-directory local import.
 */

const SETTLEMENT_DIR = path.join(__dirname, "..");
const CONTRACTS_DIR = path.join(SETTLEMENT_DIR, "contracts");
const ARTIFACTS_DIR = path.join(SETTLEMENT_DIR, "artifacts");
const VERIFIER_SOURCE_PATH = path.join(
  SETTLEMENT_DIR,
  "..",
  "..",
  "zk",
  "verifier",
  "contracts",
  "TransferValidityVerifier.sol"
);

function findSources(dir: string, base = dir): Record<string, { content: string }> {
  const sources: Record<string, { content: string }> = {};
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      Object.assign(sources, findSources(fullPath, base));
    } else if (entry.name.endsWith(".sol")) {
      const relative = path.relative(base, fullPath).split(path.sep).join("/");
      sources[`contracts/${relative}`] = { content: fs.readFileSync(fullPath, "utf8") };
    }
  }
  return sources;
}

function main() {
  if (!fs.existsSync(VERIFIER_SOURCE_PATH)) {
    console.error(
      `${path.relative(process.cwd(), VERIFIER_SOURCE_PATH)} not found — run \`npm run compile:zk\` (zk/circuits) first.`
    );
    process.exit(1);
  }

  const sources = findSources(CONTRACTS_DIR);
  sources["contracts/TransferValidityVerifier.sol"] = {
    content: fs.readFileSync(VERIFIER_SOURCE_PATH, "utf8"),
  };

  const input = {
    language: "Solidity",
    sources,
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"],
        },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  const errors = (output.errors ?? []).filter((e: { severity: string }) => e.severity === "error");
  for (const e of output.errors ?? []) {
    console[e.severity === "error" ? "error" : "warn"](e.formattedMessage);
  }
  if (errors.length > 0) {
    process.exit(1);
  }

  for (const [sourceName, fileOutput] of Object.entries<any>(output.contracts)) {
    if (!sourceName.startsWith("contracts/")) continue;

    for (const [contractName, contract] of Object.entries<any>(fileOutput)) {
      const outDir = path.join(ARTIFACTS_DIR, sourceName);
      fs.mkdirSync(outDir, { recursive: true });

      const artifact = {
        _format: "hh-sol-artifact-1",
        contractName,
        sourceName,
        abi: contract.abi,
        bytecode: `0x${contract.evm.bytecode.object}`,
        deployedBytecode: `0x${contract.evm.deployedBytecode.object}`,
        linkReferences: {},
        deployedLinkReferences: {},
      };

      fs.writeFileSync(
        path.join(outDir, `${contractName}.json`),
        JSON.stringify(artifact, null, 2)
      );
      console.log(`compiled ${sourceName}:${contractName}`);
    }
  }
}

main();

import * as fs from "node:fs";
import * as path from "node:path";
import solc from "solc";

/**
 * Compiles contracts/HydroGovernor.sol with the npm-installed `solc`
 * package — same reason as contracts/token: Hardhat's own compiler
 * downloader is blocked by this environment's network policy.
 *
 * Tests need real HydroToken (the voting token) and HydroStaking (the
 * realistic governed target) contracts, not mocks, so this copies both
 * in the same way contracts/staking copies HydroToken — see
 * contracts/staking/scripts/compile.ts.
 */

const GOVERNANCE_DIR = path.join(__dirname, "..");
const CONTRACTS_DIR = path.join(GOVERNANCE_DIR, "contracts");
const ARTIFACTS_DIR = path.join(GOVERNANCE_DIR, "artifacts");

const COPIED_SOURCES = [
  path.join(GOVERNANCE_DIR, "..", "token", "contracts", "HydroToken.sol"),
  path.join(GOVERNANCE_DIR, "..", "staking", "contracts", "HydroStaking.sol"),
];

function resolveImport(importPath: string): { contents: string } | { error: string } {
  try {
    const resolved = require.resolve(importPath, { paths: [CONTRACTS_DIR, __dirname] });
    return { contents: fs.readFileSync(resolved, "utf8") };
  } catch (err) {
    return { error: `File not found: ${importPath}` };
  }
}

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
  const sources = findSources(CONTRACTS_DIR);

  for (const sourcePath of COPIED_SOURCES) {
    if (!fs.existsSync(sourcePath)) {
      console.error(`${path.relative(process.cwd(), sourcePath)} not found.`);
      process.exit(1);
    }
    sources[`contracts/${path.basename(sourcePath)}`] = { content: fs.readFileSync(sourcePath, "utf8") };
  }

  const input = {
    language: "Solidity",
    sources,
    settings: {
      // @openzeppelin/contracts (^5.0.2, resolves to 5.6.x) uses the MCOPY
      // opcode in some utilities; MCOPY needs evmVersion >= cancun.
      evmVersion: "cancun",
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"],
        },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: resolveImport }));

  const errors = (output.errors ?? []).filter((e: { severity: string }) => e.severity === "error");
  for (const e of output.errors ?? []) {
    console[e.severity === "error" ? "error" : "warn"](e.formattedMessage);
  }
  if (errors.length > 0) {
    process.exit(1);
  }

  // Unlike the other packages' compile.ts, this doesn't skip non-local
  // sources: tests deploy TimelockController directly (not just inherit
  // from it), so its own artifact needs to exist too, not just be
  // compiled into HydroGovernor's bytecode.
  for (const [sourceName, fileOutput] of Object.entries<any>(output.contracts)) {
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

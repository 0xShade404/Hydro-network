import * as fs from "node:fs";
import * as path from "node:path";
import solc from "solc";

/**
 * Compiles contracts/*.sol (the generated Verifier — see
 * zk/circuits/scripts/compile.ts) with the npm-installed `solc` package,
 * for the same reason contracts/token does: Hardhat's own compiler
 * downloader is blocked by this environment's network policy. See
 * contracts/token/README.md and contracts/token/scripts/compile.ts, which
 * this mirrors.
 */

const CONTRACTS_DIR = path.join(__dirname, "..", "contracts");
const ARTIFACTS_DIR = path.join(__dirname, "..", "artifacts");

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
  if (!fs.existsSync(dir)) return sources;
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
  if (Object.keys(sources).length === 0) {
    console.error(
      `No contracts found in ${CONTRACTS_DIR} — run \`npm run compile:zk\` (zk/circuits) first to generate the Verifier contract.`
    );
    process.exit(1);
  }

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

  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: resolveImport }));

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

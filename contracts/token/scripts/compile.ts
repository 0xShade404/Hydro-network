import * as fs from "node:fs";
import * as path from "node:path";
import solc from "solc";

/**
 * Compiles contracts/*.sol with the npm-installed `solc` package and writes
 * artifacts in the same JSON shape Hardhat itself produces, so
 * hardhat-ethers' `ethers.getContractFactory` and `hre.artifacts` can read
 * them unchanged.
 *
 * This exists because Hardhat's built-in `compile` task downloads the
 * solc binary from binaries.soliditylang.org at run time, which this
 * environment's network policy blocks. The npm `solc` package bundles the
 * compiler itself, so it needs no extra network access beyond `npm install`.
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

  const output = JSON.parse(
    solc.compile(JSON.stringify(input), { import: resolveImport })
  );

  const errors = (output.errors ?? []).filter((e: { severity: string }) => e.severity === "error");
  for (const e of output.errors ?? []) {
    console[e.severity === "error" ? "error" : "warn"](e.formattedMessage);
  }
  if (errors.length > 0) {
    process.exit(1);
  }

  for (const [sourceName, fileOutput] of Object.entries<any>(output.contracts)) {
    if (!sourceName.startsWith("contracts/")) continue; // skip OZ deps, etc.

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

import { formatProofForContract, generateTransferProof } from "../src/index";

/**
 * Generates an example transfer proof (sender: 100 -> 70, recipient: 10 -> 40)
 * and prints it, along with the calldata shape for the Verifier contract.
 * Run `npm run compile:zk` first.
 */
async function main() {
  const proof = await generateTransferProof({
    senderBalanceBefore: 100n,
    amount: 30n,
    senderBalanceAfter: 70n,
    recipientBalanceBefore: 10n,
    recipientBalanceAfter: 40n,
  });

  console.log("raw proof:");
  console.log(JSON.stringify(proof, null, 2));

  console.log("\nformatted for Verifier.verifyTx(proof, input):");
  const formatted = formatProofForContract(proof);
  console.log(
    JSON.stringify(formatted, (_key, value) => (typeof value === "bigint" ? value.toString() : value), 2)
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

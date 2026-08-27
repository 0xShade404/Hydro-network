import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

// Must match chain/config/local.json and contracts/token/hardhat.config.ts.
const HYDRO_LOCAL_CHAIN_ID = 90731;

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: HYDRO_LOCAL_CHAIN_ID,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: HYDRO_LOCAL_CHAIN_ID,
    },
  },
};

export default config;

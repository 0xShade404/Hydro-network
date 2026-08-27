import { createHydroClient } from "@hydro/sdk";
import { config } from "./config";

/** Shared read-only client used by the whole app. */
export const client = createHydroClient({ rpcUrl: config.rpcUrl });

import { refreshRates } from "@pricepilot/intel";
import { loadEnv } from "./env.js";
import { buildServer } from "./server.js";

async function main(): Promise<void> {
  const env = loadEnv();
  const app = await buildServer({ env });

  // Warm the FX cache in the background, then refresh periodically. Best-effort
  // — currency normalization falls back to the seed rates if this never lands.
  void refreshRates();
  const fxTimer = setInterval(() => void refreshRates(), 12 * 60 * 60_000);
  fxTimer.unref();

  try {
    await app.listen({ host: env.API_HOST, port: env.API_PORT });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void main();

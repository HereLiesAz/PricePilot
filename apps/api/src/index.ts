import { loadEnv } from "./env.js";
import { buildServer } from "./server.js";

async function main(): Promise<void> {
  const env = loadEnv();
  const app = await buildServer({ env });

  try {
    await app.listen({ host: env.API_HOST, port: env.API_PORT });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void main();

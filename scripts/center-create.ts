/**
 * Creates a center and its first admin, and prints the center code. Centers
 * normally register themselves at /register; this is for development and
 * recovery.
 *
 * Usage:
 *   pnpm center:create --center "<center name>" --name "<admin name>"
 *                      --email <email> --username <u> [--password <p>]
 *                      [--timezone Asia/Hebron] [--locale ar]
 *
 * Leave out --password to type it at a hidden prompt, so it doesn't end up in
 * your shell history.
 */
import { createInterface } from "node:readline";
import { parseArgs } from "node:util";
import { CenterError, createCenter } from "@/server/centers";
import { closeMongoClient, getDb } from "@/server/db";
import { ensureIndexes } from "@/server/indexes";
import { loadEnv } from "./load-env";

const USAGE =
  'Usage: pnpm center:create --center "<center name>" --name "<admin name>" --email <email> --username <u> [--password <p>] [--timezone Asia/Hebron] [--locale ar]';

/** Reads a line from the terminal without echoing it. */
function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const output = rl as unknown as { _writeToOutput: (text: string) => void };
    let prompted = false;
    output._writeToOutput = (text) => {
      if (!prompted) {
        process.stdout.write(text);
        prompted = true;
      }
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

async function main() {
  loadEnv();
  const { values } = parseArgs({
    options: {
      center: { type: "string" },
      name: { type: "string" },
      email: { type: "string" },
      username: { type: "string" },
      password: { type: "string" },
      timezone: { type: "string" },
      locale: { type: "string" },
    },
    strict: true,
  });

  if (!values.center || !values.name || !values.email || !values.username) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }

  let password = values.password;
  if (!password) {
    password = await promptHidden("Password: ");
    const confirmation = await promptHidden("Repeat password: ");
    if (password !== confirmation) {
      console.error("Passwords do not match.");
      process.exitCode = 1;
      return;
    }
  }

  await ensureIndexes(getDb());
  const result = await createCenter({
    centerName: values.center,
    adminName: values.name,
    email: values.email,
    username: values.username,
    password,
    timezone: values.timezone ?? "Asia/Hebron",
    ...(values.locale ? { locale: values.locale as "ar" } : {}),
  });

  console.log(`Created center "${result.centerName}" (${result.tenantId}).`);
  console.log(`Center code: ${result.code}`);
  console.log(`Admin username: ${result.username}`);
}

main()
  .catch((error: unknown) => {
    if (error instanceof CenterError) console.error(error.message);
    else console.error(error);
    process.exitCode = 1;
  })
  .finally(closeMongoClient);

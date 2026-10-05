/**
 * Creates a teacher account (and the tenant if it doesn't exist yet).
 *
 * Usage:
 *   pnpm user:create --tenant "<name>" --username <u> --name "<display name>"
 *                    [--password <p>] [--locale ar] [--timezone Asia/Hebron]
 *
 * Leave out --password to type it at a hidden prompt, so it doesn't end up in
 * your shell history.
 */
import { createInterface } from "node:readline";
import { parseArgs } from "node:util";
import { AccountError, createTeacherAccount } from "@/server/accounts";
import { closeMongoClient, getDb } from "@/server/db";
import { ensureIndexes } from "@/server/indexes";
import { loadEnv } from "./load-env";

const USAGE =
  'Usage: pnpm user:create --tenant "<name>" --username <u> --name "<display name>" [--password <p>] [--locale ar] [--timezone Asia/Hebron]';

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
      tenant: { type: "string" },
      username: { type: "string" },
      password: { type: "string" },
      name: { type: "string" },
      locale: { type: "string" },
      timezone: { type: "string" },
    },
    strict: true,
  });

  if (!values.tenant || !values.username || !values.name) {
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
  const result = await createTeacherAccount({
    tenantName: values.tenant,
    username: values.username,
    password,
    name: values.name,
    ...(values.locale ? { locale: values.locale as "ar" } : {}),
    ...(values.timezone ? { timezone: values.timezone } : {}),
  });

  console.log(
    `${result.createdTenant ? "Created" : "Using existing"} tenant "${result.tenantName}" (${result.tenantId}).`,
  );
  console.log(`Created user "${result.username}" (${result.userId}).`);
}

main()
  .catch((error: unknown) => {
    if (error instanceof AccountError) console.error(error.message);
    else console.error(error);
    process.exitCode = 1;
  })
  .finally(closeMongoClient);

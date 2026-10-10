export const E2E_PORT = 3100;
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;
export const E2E_PASSWORD = "e2e-password-123";

export const E2E_PROJECTS = ["iphone", "pixel", "desktop"] as const;
export const E2E_SPECS = ["main", "offline", "ltr"] as const;

/** One account per spec and browser project, so runs never share data. */
export const accountFor = (spec: (typeof E2E_SPECS)[number], project: string) =>
  `e2e_${spec}_${project}`;

/**
 * Each account is the admin of its own center, with a fixed code so the
 * specs know what to type at sign-in.
 */
export const E2E_ACCOUNTS = E2E_SPECS.flatMap((spec) =>
  E2E_PROJECTS.map((project) => ({
    username: accountFor(spec, project),
    code: centerCodeFor(spec, project),
  })),
);

export function centerCodeFor(spec: (typeof E2E_SPECS)[number], project: string): string {
  const index =
    E2E_SPECS.indexOf(spec) * E2E_PROJECTS.length +
    E2E_PROJECTS.indexOf(project as (typeof E2E_PROJECTS)[number]);
  return String(100_100 + index);
}

export const E2E_PORT = 3100;
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;
export const E2E_PASSWORD = "e2e-password-123";

export const E2E_PROJECTS = ["iphone", "pixel", "desktop"] as const;
export const E2E_SPECS = ["main", "offline", "ltr"] as const;

/** One account per spec and browser project, so runs never share data. */
export const accountFor = (spec: (typeof E2E_SPECS)[number], project: string) =>
  `e2e_${spec}_${project}`;

export const E2E_ACCOUNTS = E2E_SPECS.flatMap((spec) =>
  E2E_PROJECTS.map((project) => accountFor(spec, project)),
);

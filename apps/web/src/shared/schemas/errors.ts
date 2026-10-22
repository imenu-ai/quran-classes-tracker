import type { z } from "zod";
import type { AyahRangeErrorCode } from "@/domain/quran/validation";

/**
 * Generic validation codes. Schemas never carry display text: every issue's
 * `message` is a code, turned into text by the i18n layer
 * (`errors.validation.<CODE>` or `errors.ayahRange.<CODE>`).
 */
export const VALIDATION_CODES = [
  "REQUIRED",
  "NOT_INTEGER",
  "INVALID_TYPE",
  "TOO_SHORT",
  "TOO_LONG",
  "TOO_SMALL",
  "TOO_LARGE",
  "INVALID_FORMAT",
  "INVALID_VALUE",
  "RATES_REQUIRE_EVALUATION",
  "INVALID",
] as const;

export type ValidationCode = (typeof VALIDATION_CODES)[number];

export type ErrorCode = ValidationCode | AyahRangeErrorCode;

export type ErrorParams = Record<string, string | number>;

export interface FieldError {
  /** Dotted path of the field, "" for the whole record. */
  path: string;
  code: ErrorCode;
  params: ErrorParams;
}

/** Zod error map that turns every built-in issue into a {@link ValidationCode}. */
export const codeErrorMap: z.core.$ZodErrorMap = (issue) => {
  switch (issue.code) {
    case "invalid_type":
      if (issue.input === undefined || issue.input === null) return "REQUIRED";
      if (issue.expected === "int" || issue.format === "safeint") return "NOT_INTEGER";
      return "INVALID_TYPE";
    case "too_small":
      if (issue.origin === "string") return issue.minimum === 1 ? "REQUIRED" : "TOO_SHORT";
      return "TOO_SMALL";
    case "too_big":
      return issue.origin === "string" ? "TOO_LONG" : "TOO_LARGE";
    case "invalid_format":
      return "INVALID_FORMAT";
    case "invalid_value":
      return "INVALID_VALUE";
    default:
      return "INVALID";
  }
};

function issueParams(issue: z.core.$ZodIssue): ErrorParams {
  const params: ErrorParams = {};
  if (issue.code === "too_small") params.minimum = Number(issue.minimum);
  if (issue.code === "too_big") params.maximum = Number(issue.maximum);
  if (issue.code === "custom" && issue.params) {
    for (const [key, value] of Object.entries(issue.params)) {
      if (typeof value === "string" || typeof value === "number") params[key] = value;
    }
  }
  return params;
}

export function toFieldErrors(error: z.ZodError): FieldError[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    code: issue.message as ErrorCode,
    params: issueParams(issue),
  }));
}

export type ParseResult<T> = { success: true; data: T } | { success: false; errors: FieldError[] };

/** Parses with codes instead of text. Use this on both client and server. */
export function parseWithCodes<T extends z.ZodType>(
  schema: T,
  input: unknown,
): ParseResult<z.output<T>> {
  const result = schema.safeParse(input, { error: codeErrorMap });
  return result.success
    ? { success: true, data: result.data }
    : { success: false, errors: toFieldErrors(result.error) };
}

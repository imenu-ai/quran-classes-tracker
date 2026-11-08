import { PAGE_COUNT, pagesToPortions } from "../domain/quran/pages";
import { parseIntegerInput } from "../domain/text/digits";
import type { FieldError } from "../shared/schemas/errors";
import type { HomeworkPortion, PageRange } from "../shared/schemas/homework";

export type PageRangeField = "fromPage" | "toPage";

/** What the teacher has typed so far (any digit system). */
export interface PageRangeDraft {
  from: string;
  to: string;
}

export type PageRangeErrors = Partial<Record<PageRangeField, FieldError>>;

export type PageRangeCheck =
  | { ok: true; value: PageRange; portions: HomeworkPortion[]; errors: PageRangeErrors }
  | { ok: false; errors: PageRangeErrors };

const error = (path: PageRangeField, code: FieldError["code"], params = {}): FieldError => ({
  path,
  code,
  params,
});

function checkPage(field: PageRangeField, text: string): number | FieldError {
  if (text.trim() === "") return error(field, "REQUIRED");
  const page = parseIntegerInput(text);
  if (page === undefined || Number.isNaN(page)) return error(field, "NOT_INTEGER");
  if (page < 1) return error(field, "TOO_SMALL", { minimum: 1 });
  if (page > PAGE_COUNT) return error(field, "TOO_LARGE", { maximum: PAGE_COUNT });
  return page;
}

/**
 * Validates whole pages as they're typed (1–604, from ≤ to) and gives the
 * suras and ayahs they hold, which is what the homework stores.
 */
export function checkPageRange(draft: PageRangeDraft): PageRangeCheck {
  const errors: PageRangeErrors = {};
  const from = checkPage("fromPage", draft.from);
  const to = checkPage("toPage", draft.to);
  if (typeof from !== "number") errors.fromPage = from;
  if (typeof to !== "number") errors.toPage = to;
  if (typeof from !== "number" || typeof to !== "number") return { ok: false, errors };
  if (from > to) {
    errors.toPage = error("toPage", "PAGE_FROM_AFTER_TO");
    return { ok: false, errors };
  }
  return { ok: true, value: { from, to }, portions: pagesToPortions(from, to), errors };
}

/** The draft for a saved page range. */
export const pageRangeDraft = (pages: PageRange | null): PageRangeDraft =>
  pages ? { from: String(pages.from), to: String(pages.to) } : { from: "", to: "" };

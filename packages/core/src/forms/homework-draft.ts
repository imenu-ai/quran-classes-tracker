import {
  latestHomework,
  latestPortion,
  suggestNextHomework,
  suggestNextPages,
  type Direction,
} from "../domain/homework/suggestion";
import { pagesToPortions } from "../domain/quran/pages";
import {
  pagesOf,
  portionsOf,
  type HomeworkPortion,
  type HomeworkRecord,
  type PageRange,
} from "../shared/schemas/homework";
import { checkPageRange, pageRangeDraft, type PageRangeDraft } from "./pages";
import { checkPortions, portionDrafts, type PortionDraft } from "./portions";

/** How the homework form takes the portion: sura and ayahs, or whole pages. */
export type EntryMode = "ayahs" | "pages";

export interface HomeworkDraft {
  mode: EntryMode;
  portions: PortionDraft[];
  pages: PageRangeDraft;
  /** Pre-filled from the suggestion. */
  suggested: boolean;
}

/**
 * How the homework form opens. Editing shows the item as it was given
 * (pages or ayahs). New homework continues after the student's latest: by
 * pages when that was given as pages (the next pages of the same count),
 * otherwise by ayahs. An exam starts empty, by ayahs.
 */
export function startHomeworkDraft(input: {
  kind: "next" | "recite" | "exam" | "edit";
  item?: HomeworkRecord;
  history: readonly HomeworkRecord[];
  direction: Direction;
}): HomeworkDraft {
  if (input.item) {
    const pages = pagesOf(input.item);
    return {
      mode: pages ? "pages" : "ayahs",
      portions: portionDrafts(portionsOf(input.item)),
      pages: pageRangeDraft(pages),
      suggested: false,
    };
  }
  if (input.kind === "exam") {
    return {
      mode: "ayahs",
      portions: portionDrafts([]),
      pages: pageRangeDraft(null),
      suggested: false,
    };
  }
  const latest = latestHomework(input.history);
  const latestPages = latest ? pagesOf(latest) : null;
  if (latestPages) {
    const next = suggestNextPages(latestPages, input.direction);
    return {
      mode: "pages",
      portions: portionDrafts(next ? pagesToPortions(next.from, next.to) : []),
      pages: pageRangeDraft(next),
      suggested: next !== null,
    };
  }
  const suggestion = suggestNextHomework(latestPortion(input.history), input.direction);
  return {
    mode: "ayahs",
    portions: portionDrafts(suggestion ? [suggestion] : []),
    pages: pageRangeDraft(null),
    suggested: suggestion !== null,
  };
}

/**
 * Switching to ayahs shows the suras and ayahs of the pages typed so far
 * (when they're valid), so the teacher can adjust them.
 */
export function switchEntryMode(draft: HomeworkDraft, mode: EntryMode): HomeworkDraft {
  if (mode === draft.mode) return draft;
  if (mode === "ayahs") {
    const pages = checkPageRange(draft.pages);
    return {
      ...draft,
      mode,
      portions: pages.ok ? portionDrafts(pages.portions) : draft.portions,
    };
  }
  return { ...draft, mode };
}

export type HomeworkDraftCheck =
  { ok: true; portions: HomeworkPortion[]; pages: PageRange | null } | { ok: false };

/** What saving stores: the pages' portions and range, or the ayah portions without pages. */
export function checkHomeworkDraft(draft: HomeworkDraft): HomeworkDraftCheck {
  if (draft.mode === "pages") {
    const pages = checkPageRange(draft.pages);
    return pages.ok ? { ok: true, portions: pages.portions, pages: pages.value } : { ok: false };
  }
  const portions = checkPortions(draft.portions);
  return portions.ok ? { ok: true, portions: portions.value, pages: null } : { ok: false };
}

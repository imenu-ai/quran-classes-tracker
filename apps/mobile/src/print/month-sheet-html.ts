import type { HistoryRow, MonthSheet } from "@qct/core/domain/stats/month-sheet";
import { isExam, type HomeworkRecord } from "@qct/core/shared/schemas/homework";
import { qrSvgMarkup } from "@qct/core/shared/qr";

/** The words and formats a sheet needs, from the app's messages and formats. */
export interface SheetText {
  t: (key: string, values?: Record<string, string | number>) => string;
  /** "الأحد 5" for a row's date. */
  day: (date: string) => string;
  /** "أكتوبر 2026" for a "YYYY-MM" month. */
  month: (month: string) => string;
  /** "25 أكتوبر 2026" for a "YYYY-MM-DD" date. */
  date: (date: string) => string;
  average: (value: number | null) => string;
  portion: (item: Pick<HomeworkRecord, "surah" | "fromAyah" | "toAyah">) => string;
}

export interface SheetsInput {
  sheets: readonly MonthSheet[];
  centerName: string;
  className: string;
  userName: string;
  /** "YYYY-MM". */
  month: string;
  /** Today, "YYYY-MM-DD" in the center's time zone. */
  printedOn: string;
  /** Each student's parent link, printed as a QR code. */
  parentUrl: (studentId: string) => string;
  /** `@font-face` rules embedding the font (empty: the system font). */
  fontCss: string;
  text: SheetText;
}

const escape = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** User text (names, notes) isolated, so its direction can't reorder the sentence. */
const bdi = (value: string) => `<bdi>${escape(value)}</bdi>`;

/**
 * Smaller text and tighter rows for longer months, so a month stays on one
 * page, with the web's limits (apps/web month-sheet.tsx): up to 24 rows as
 * is, up to 34 dense, then denser.
 */
const densityOf = (rows: number) => (rows > 34 ? "denser" : rows > 24 ? "dense" : "normal");

const STYLE = `
@page { size: A4; margin: 12mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: "Plex Arabic", sans-serif; color: #171717; background: #fff; }
.sheet { display: flex; flex-direction: column; gap: 3mm; font-size: 10pt; line-height: 1.45; }
.sheet + .sheet { break-before: page; page-break-before: always; }
.sheet.dense { gap: 2mm; font-size: 8.5pt; line-height: 1.35; }
.sheet.denser { gap: 1.5mm; font-size: 7.5pt; line-height: 1.25; }
.top { display: flex; align-items: flex-start; gap: 4mm; }
.who { flex: 1; display: flex; flex-direction: column; gap: 1.5mm; min-width: 0; }
header { border-bottom: 2px solid #262626; padding-bottom: 1.5mm; }
.center { margin: 0; font-size: 15pt; line-height: 1.2; font-weight: 700; }
.subtitle { margin: 0; font-size: 10.5pt; color: #525252; }
dl { margin: 0; }
dd { margin: 0; }
.details { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5mm 6mm; }
.details div { display: flex; gap: 2mm; }
.details dt { color: #525252; }
.details dd { font-weight: 700; }
.details .name { font-size: 12pt; line-height: 1.2; }
figure { margin: 0; width: 22mm; display: flex; flex-direction: column; align-items: center; gap: 0.5mm; }
figure svg { width: 20mm; height: 20mm; }
figcaption { font-size: 7pt; line-height: 1.2; text-align: center; color: #525252; }
table { width: 100%; table-layout: fixed; border-collapse: collapse; }
col.date { width: 24mm; }
col.mark { width: 18mm; }
th, td { border: 1px solid #a3a3a3; padding: 0.5mm 2mm; text-align: start; vertical-align: top; }
.sheet.dense td, .sheet.denser td { padding-top: 0; padding-bottom: 0; }
thead, tfoot { background: #f5f5f5; }
tfoot { font-weight: 700; }
.mid { text-align: center; }
.strong { font-weight: 700; }
tr { break-inside: avoid; page-break-inside: avoid; }
tr.exam { background: #f5f3ff; }
tr.absence { background: #fafafa; }
.exam-badge { margin-inline-start: 2mm; border: 1px solid #6d28d9; border-radius: 1mm; padding: 0 1.5mm; font-size: 0.85em; font-weight: 700; color: #5b21b6; }
.exam-mark { color: #5b21b6; font-weight: 700; }
.muted { color: #525252; }
.counts { display: grid; grid-template-columns: repeat(6, 1fr); gap: 1.5mm; }
.counts div { border: 1px solid #a3a3a3; border-radius: 1mm; padding: 0.5mm 1mm; text-align: center; }
.counts dt { font-size: 0.85em; line-height: 1.2; color: #525252; }
.counts dd { font-size: 1.15em; line-height: 1.2; font-weight: 700; }
footer { display: flex; justify-content: space-between; border-top: 1px solid #d4d4d4; padding-top: 1mm; font-size: 8pt; color: #737373; }
`;

function rowHtml(row: HistoryRow, text: SheetText): string {
  const { t } = text;
  const score = (value: number | null) => (value === null ? t("common.noValue") : String(value));
  const day = `<td>${escape(text.day(row.lesson.date))}</td>`;
  if (row.kind === "absence") {
    const note = row.record.excuseNote
      ? ` <span class="muted">· ${bdi(row.record.excuseNote)}</span>`
      : "";
    return `<tr class="absence">${day}<td colspan="3"><span class="strong">${escape(t(`glossary.${row.record.status}`))}</span>${note}</td></tr>`;
  }
  const exam = row.kind === "evaluation" && isExam(row.item);
  const portion = `<td>${bdi(text.portion(row.item))}${exam ? `<span class="exam-badge">${escape(t("exam.badge"))}</span>` : ""}</td>`;
  const marks = exam
    ? `<td colspan="2" class="mid exam-mark">${score(row.item.memorizationRate)}</td>`
    : row.kind === "postponed"
      ? `<td colspan="2" class="mid">${escape(t("today.postponed"))}</td>`
      : `<td class="mid strong">${score(row.item.memorizationRate)}</td><td class="mid strong">${score(row.item.behaviorRate)}</td>`;
  return `<tr${exam ? ' class="exam"' : ""}>${day}${portion}${marks}</tr>`;
}

function sheetHtml(sheet: MonthSheet, input: SheetsInput): string {
  const { text } = input;
  const { t } = text;
  const detail = (label: string, value: string, extra = "") =>
    `<div><dt>${escape(label)}:</dt><dd${extra}>${value}</dd></div>`;
  const counts: [string, number][] = [
    [t("print.present"), sheet.counts.present],
    [t("print.absent"), sheet.counts.absent],
    [t("print.excused"), sheet.counts.excused],
    [t("print.evaluated"), sheet.counts.evaluated],
    [t("print.exams"), sheet.counts.exams],
    [t("print.postponed"), sheet.counts.postponed],
  ];
  const rows =
    sheet.rows.length === 0
      ? `<tr><td colspan="4" class="mid">${escape(t("profile.noHistory"))}</td></tr>`
      : sheet.rows.map((row) => rowHtml(row, text)).join("");
  return `<article class="sheet ${densityOf(sheet.rows.length)}">
<div class="top">
  <div class="who">
    <header><p class="center">${bdi(input.centerName)}</p><p class="subtitle">${escape(t("print.title"))}</p></header>
    <dl class="details">
      ${detail(t("print.student"), bdi(sheet.student.fullName), ' class="name"')}
      ${detail(t("print.month"), escape(text.month(input.month)))}
      ${detail(t("print.class"), bdi(input.className))}
      ${detail(t("print.preparedBy"), bdi(input.userName))}
    </dl>
  </div>
  <figure>${qrSvgMarkup(input.parentUrl(sheet.student.id), t("print.qrCaption"))}<figcaption>${escape(t("print.qrCaption"))}</figcaption></figure>
</div>
<table>
  <colgroup><col class="date"><col><col class="mark"><col class="mark"></colgroup>
  <thead><tr><th>${escape(t("profile.dateHeader"))}</th><th>${escape(t("glossary.homework"))}</th><th class="mid">${escape(t("profile.memorizationShort"))}</th><th class="mid">${escape(t("profile.behaviorShort"))}</th></tr></thead>
  <tbody>${rows}</tbody>
  <tfoot><tr><th colspan="2">${escape(t("profile.average"))}</th><td class="mid">${escape(text.average(sheet.memorizationAverage))}</td><td class="mid">${escape(text.average(sheet.behaviorAverage))}</td></tr></tfoot>
</table>
<dl class="counts">${counts.map(([name, value]) => `<div><dt>${escape(name)}</dt><dd>${value}</dd></div>`).join("")}</dl>
<footer><span>${escape(t("app.name"))}</span><span>${escape(t("print.printedOn"))}: ${escape(text.date(input.printedOn))}</span></footer>
</article>`;
}

/**
 * The students' month sheets as one HTML document for expo-print, one A4
 * page per student, laid out like the web's printed sheet (same data from
 * the shared builders, fixed light colours, the parent link's QR beside the
 * header, the font embedded).
 */
export function buildSheetsHtml(input: SheetsInput): string {
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8"><title>${escape(input.text.t("print.title"))}</title><style>${input.fontCss}${STYLE}</style></head>
<body>${input.sheets.map((sheet) => sheetHtml(sheet, input)).join("\n")}</body>
</html>`;
}

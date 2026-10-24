// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openLocalDb, type LocalDb } from "@/client/db/dexie";
import { LocalStore } from "@/client/db/local-store";
import { classRecord, studentRecord } from "@qct/core/test/records";
import { installDomPolyfills, renderArabic } from "@/test/dom";
import { StudentFormDrawer } from "./student-form-drawer";

const app = vi.hoisted(() => ({ current: {} as { db: unknown; store: unknown } }));
vi.mock("@/client/app-context", () => ({ useApp: () => app.current }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

installDomPolyfills();

describe("StudentFormDrawer: the parent ID", () => {
  let db: LocalDb;
  const cls = classRecord();
  const student = studentRecord(cls.id, { fullName: "أحمد" });

  beforeEach(async () => {
    db = openLocalDb(`student-form-${crypto.randomUUID()}`);
    await db.classes.put(cls);
    await db.students.put(student);
    app.current = { db, store: new LocalStore(db, { tenantId: "t1", deviceId: "d1" }) };
  });

  afterEach(async () => {
    db.close();
    await db.delete();
  });

  it("saves it normalized, as typed in Arabic digits with separators", async () => {
    const onOpenChange = vi.fn();
    renderArabic(
      <StudentFormDrawer open onOpenChange={onOpenChange} classId={cls.id} existing={student} />,
    );
    await userEvent.type(
      screen.getByRole("textbox", { name: "رقم هوية ولي الأمر" }),
      "٤٠١ ٢٣٤-٥٦٧",
    );
    await userEvent.click(screen.getByRole("button", { name: "حفظ" }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect((await db.students.get(student.id))?.parentId).toBe("401234567");
  });

  it("explains a wrong one under the field", async () => {
    renderArabic(
      <StudentFormDrawer open onOpenChange={vi.fn()} classId={cls.id} existing={student} />,
    );
    await userEvent.type(screen.getByRole("textbox", { name: "رقم هوية ولي الأمر" }), "12");
    await userEvent.click(screen.getByRole("button", { name: "حفظ" }));

    expect(await screen.findByText("الصيغة غير صحيحة")).toBeTruthy();
    expect((await db.students.get(student.id))?.parentId).toBe("");
  });
});

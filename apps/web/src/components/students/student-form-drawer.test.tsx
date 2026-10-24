// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LocalDatabase } from "@qct/core/data/database";
import { LocalStore } from "@qct/core/data/local-store";
import { openLocalDatabase } from "@/client/db/dexie";
import { classRecord, studentRecord } from "@qct/core/test/records";
import { installDomPolyfills, renderArabic } from "@/test/dom";
import { StudentFormDrawer } from "./student-form-drawer";

const app = vi.hoisted(() => ({ current: {} as { db: unknown; store: unknown } }));
vi.mock("@/client/app-context", () => ({ useApp: () => app.current }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

installDomPolyfills();

describe("StudentFormDrawer: the parent ID", () => {
  let db: LocalDatabase;
  const cls = classRecord();
  const student = studentRecord(cls.id, { fullName: "أحمد" });

  beforeEach(async () => {
    db = openLocalDatabase(`student-form-${crypto.randomUUID()}`);
    await db.transaction(async (tx) => {
      await tx.put("classes", cls);
      await tx.put("students", student);
    });
    app.current = { db, store: new LocalStore(db, { tenantId: "t1", deviceId: "d1" }) };
  });

  afterEach(async () => {
    await db.destroy();
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
    expect((await db.get("students", student.id))?.parentId).toBe("401234567");
  });

  it("explains a wrong one under the field", async () => {
    renderArabic(
      <StudentFormDrawer open onOpenChange={vi.fn()} classId={cls.id} existing={student} />,
    );
    await userEvent.type(screen.getByRole("textbox", { name: "رقم هوية ولي الأمر" }), "12");
    await userEvent.click(screen.getByRole("button", { name: "حفظ" }));

    expect(await screen.findByText("الصيغة غير صحيحة")).toBeTruthy();
    expect((await db.get("students", student.id))?.parentId).toBe("");
  });
});

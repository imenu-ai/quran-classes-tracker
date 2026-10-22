// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { classRecord, studentRecord } from "@/test/records";
import { installDomPolyfills, renderArabic } from "@/test/dom";
import { ParentLinkDrawer } from "./parent-link-drawer";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

installDomPolyfills();

const cls = classRecord();

function renderDrawer(parentId: string) {
  const student = studentRecord(cls.id, { fullName: "أحمد", parentId });
  renderArabic(<ParentLinkDrawer open onOpenChange={vi.fn()} student={student} />);
  return `${window.location.origin}/parent?s=${student.id}`;
}

describe("ParentLinkDrawer", () => {
  it("shows the student's link and its QR code", () => {
    const url = renderDrawer("401234567");
    expect(screen.getByText(url)).toBeTruthy();
    expect(
      screen.getByRole("img", { name: "رمز QR لرابط ولي الأمر" }).getAttribute("data-qr-value"),
    ).toBe(url);
    expect(screen.queryByText(/لم يُسجَّل رقم هوية ولي الأمر/)).toBeNull();
  });

  it("warns that the link won't work without a parent ID", () => {
    renderDrawer("");
    expect(screen.getByText(/لم يُسجَّل رقم هوية ولي الأمر بعد/)).toBeTruthy();
  });

  it("copies the link", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    const url = renderDrawer("401234567");
    await user.click(screen.getByRole("button", { name: "نسخ الرابط" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(url));
    expect(toast.success).toHaveBeenCalledWith("تم نسخ الرابط");
  });
});

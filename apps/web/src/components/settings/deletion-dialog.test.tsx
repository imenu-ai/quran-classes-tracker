// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ar from "@qct/core/messages/ar.json";
import type { ApiResult } from "@qct/core/shared/api";
import { installDomPolyfills, renderArabic } from "@/test/dom";
import { DeletionDialog } from "./deletion-dialog";

installDomPolyfills();

const t = ar.deletion;

function renderDialog(results: ApiResult<unknown>[]) {
  const onDelete = vi.fn(async () => results.shift() ?? { ok: true as const, value: {} });
  const onDeleted = vi.fn(async () => {});
  renderArabic(
    <DeletionDialog
      open
      onOpenChange={vi.fn()}
      title={t.accountTitle}
      description={t.accountDescription}
      submitLabel={t.deleteAccount}
      onDelete={onDelete}
      onDeleted={onDeleted}
    >
      <p>{t.accountAdminHint}</p>
    </DeletionDialog>,
  );
  return { onDelete, onDeleted };
}

describe("DeletionDialog", () => {
  it("says what goes and needs the password before it deletes", () => {
    renderDialog([]);
    expect(screen.getByRole("dialog", { name: t.accountTitle })).toBeTruthy();
    expect(screen.getByText(t.accountDescription)).toBeTruthy();
    expect(screen.getByText(t.accountAdminHint)).toBeTruthy();
    expect(screen.getByRole("button", { name: t.deleteAccount }).hasAttribute("disabled")).toBe(
      true,
    );
  });

  it("shows the server's refusal, then deletes with the right password", async () => {
    const user = userEvent.setup();
    const { onDelete, onDeleted } = renderDialog([
      { ok: false, code: "WRONG_PASSWORD", errors: [] },
      { ok: false, code: "LAST_ADMIN", errors: [] },
    ]);
    const password = screen.getByLabelText(t.password);

    await user.type(password, "guess");
    await user.click(screen.getByRole("button", { name: t.deleteAccount }));
    expect(await screen.findByText(t.errors.wrongPassword)).toBeTruthy();
    expect(onDelete).toHaveBeenLastCalledWith("guess");

    await user.clear(password);
    await user.type(password, "my-password");
    expect(screen.queryByText(t.errors.wrongPassword)).toBeNull();
    await user.click(screen.getByRole("button", { name: t.deleteAccount }));
    expect(await screen.findByText(t.errors.lastAdmin)).toBeTruthy();
    expect(onDeleted).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: t.deleteAccount }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce());
    expect(onDelete).toHaveBeenLastCalledWith("my-password");
  });
});

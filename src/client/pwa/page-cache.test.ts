import { describe, expect, it } from "vitest";
import { APP_SHELL_PATHS, pageCacheKey } from "./page-cache";

describe("pageCacheKey", () => {
  it("drops the query so one cached shell serves every id", () => {
    expect(pageCacheKey("https://app.example/student?id=abc")).toBe("https://app.example/student");
    expect(pageCacheKey("https://app.example/lesson?id=1&step=evaluate")).toBe(
      "https://app.example/lesson",
    );
    expect(pageCacheKey("https://app.example/")).toBe("https://app.example/");
  });

  it("warms every signed-in page shell", () => {
    expect(APP_SHELL_PATHS).toEqual([
      "/",
      "/class",
      "/student",
      "/lesson",
      "/search",
      "/users",
      "/settings",
    ]);
  });
});

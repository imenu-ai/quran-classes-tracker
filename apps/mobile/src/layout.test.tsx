import * as ReactNative from "react-native";
import { Text } from "react-native";
import { render, screen } from "@testing-library/react-native";
import * as ScreenOrientation from "expo-screen-orientation";
import { columnsFor, Grid } from "@/components/grid";
import { isTablet, lockPhonesToPortrait } from "@/device/orientation";

jest.mock("expo-screen-orientation", () => ({
  lockAsync: jest.fn(async () => {}),
  OrientationLock: { PORTRAIT_UP: 1 },
}));

// React Native's exports are getters, so the hook is mocked at its module.
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 390, height: 844, scale: 2, fontScale: 1 })),
}));
const useWindowDimensions = jest.requireMock<{ default: jest.Mock }>(
  "react-native/Libraries/Utilities/useWindowDimensions",
).default;
const window = (width: number, height = 900) =>
  useWindowDimensions.mockReturnValue({ width, height, scale: 2, fontScale: 1 });

const screenSize = (width: number, height: number) =>
  jest
    .spyOn(ReactNative.Dimensions, "get")
    .mockReturnValue({ width, height, scale: 2, fontScale: 1 });

afterEach(() => {
  jest.restoreAllMocks();
  window(390, 844);
});

describe("tablet layouts", () => {
  it("uses the web's breakpoints for columns, up to each grid's maximum", () => {
    expect(columnsFor(390, 3)).toBe(1);
    expect(columnsFor(768, 3)).toBe(2);
    expect(columnsFor(1280, 3)).toBe(3);
    expect(columnsFor(1280, 2)).toBe(2);
  });

  it("lays cards out in rows, padding a short last row", async () => {
    window(1280);
    await render(
      <Grid maxColumns={3}>
        {["أ", "ب", "ج", "د"].map((label) => (
          <Text key={label}>{label}</Text>
        ))}
      </Grid>,
    );
    // Two rows of three cells: four cards and two empty ones.
    expect(screen.getByText("د")).toBeOnTheScreen();
    const rows = screen.toJSON() as { children: { children: unknown[] }[] };
    expect(rows.children).toHaveLength(2);
    expect(rows.children[1]!.children).toHaveLength(3);
  });

  it("keeps a single column on a phone", async () => {
    window(390);
    await render(
      <Grid maxColumns={3}>
        <Text>أ</Text>
        <Text>ب</Text>
      </Grid>,
    );
    // No row wrappers: the two cards render one under the other.
    expect(screen.getByText("ب")).toBeOnTheScreen();
    expect(JSON.stringify(screen.toJSON())).not.toContain('"type":"View"');
  });

  it("locks phones to portrait and lets tablets turn", () => {
    screenSize(390, 844);
    expect(isTablet()).toBe(false);
    lockPhonesToPortrait();
    expect(ScreenOrientation.lockAsync).toHaveBeenCalledWith(1);

    jest.mocked(ScreenOrientation.lockAsync).mockClear();
    screenSize(1280, 800);
    expect(isTablet()).toBe(true);
    lockPhonesToPortrait();
    expect(ScreenOrientation.lockAsync).not.toHaveBeenCalled();
  });
});

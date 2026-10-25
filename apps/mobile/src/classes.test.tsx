import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { router, useLocalSearchParams } from "expo-router";
import { archiveClass, createClass } from "@qct/core/data/entities/classes";
import { createStudent } from "@qct/core/data/entities/students";
import ar from "@qct/core/messages/ar.json";
import { createTestServices, renderWithApp } from "@/test/app-services";
import HomeScreen from "./app/(tabs)/(home)/index";
import ClassScreen from "./app/(tabs)/(home)/class/[id]";
import SearchScreen from "./app/(tabs)/search/index";
import ArchiveClassSheet from "./app/archive-class";
import ClassFormSheet from "./app/class-form";
import StudentFormScreen from "./app/student-form";
import StudentScreen from "./screens/student-screen";

jest.mock("expo-router", () => jest.requireActual("@/test/expo-router-mock"));

const params = useLocalSearchParams as jest.Mock;
const admin = () => createTestServices({ session: { role: "admin" } });
const button = (name: string) => screen.getByRole("button", { name });

const studentInput = (classId: string, fullName: string) => ({
  classId,
  fullName,
  birthYear: 2015,
  note: "",
  memorizationDirection: "forward" as const,
  parentId: "",
});

beforeEach(() => {
  jest.clearAllMocks();
  params.mockReturnValue({});
});

describe("home", () => {
  it("offers an admin to create the first class", async () => {
    await renderWithApp(<HomeScreen />, admin());
    expect(await screen.findByText(ar.classes.emptyTitle)).toBeOnTheScreen();
    await fireEvent.press(button(ar.classes.create));
    expect(router.push).toHaveBeenCalledWith("/class-form");
  });

  it("tells a teacher without classes to ask for one, with nothing to create", async () => {
    await renderWithApp(<HomeScreen />);
    expect(await screen.findByText(ar.classes.emptyAssignedTitle)).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: ar.classes.create })).toBeNull();
  });

  it("lists classes with their student count, and archived ones collapsed", async () => {
    const services = admin();
    const fajr = await createClass(services.store, "حلقة الفجر");
    await createStudent(services.store, studentInput(fajr.id, "أحمد"));
    const old = await createClass(services.store, "حلقة قديمة");
    await archiveClass(services.store, old.id);
    await renderWithApp(<HomeScreen />, services);
    expect(await screen.findByText("حلقة الفجر")).toBeOnTheScreen();
    expect(screen.getByText("طالب واحد")).toBeOnTheScreen();
    expect(screen.queryByText("حلقة قديمة")).toBeNull();
    await fireEvent.press(button(`${ar.classes.archivedTitle} (1)`));
    expect(screen.getByText("حلقة قديمة")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("حلقة الفجر"));
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/class/[id]",
      params: { id: fajr.id },
    });
  });
});

describe("the class form sheet", () => {
  it("asks for a name, then creates the class and opens it", async () => {
    const services = admin();
    await renderWithApp(<ClassFormSheet />, services);
    await fireEvent.press(button(ar.classes.create));
    expect(await screen.findByText(ar.errors.validation.REQUIRED)).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText(ar.classes.name), "حلقة العصر");
    await fireEvent.press(button(ar.classes.create));
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
    const [created] = await services.db.all("classes");
    expect(created?.name).toBe("حلقة العصر");
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/class/[id]",
      params: { id: created!.id },
    });
  });

  it("renames, starting from the current name", async () => {
    const services = admin();
    const cls = await createClass(services.store, "حلقة الفجر");
    params.mockReturnValue({ id: cls.id });
    await renderWithApp(<ClassFormSheet />, services);
    const field = await screen.findByDisplayValue("حلقة الفجر");
    await fireEvent.changeText(field, "حلقة الضحى");
    await fireEvent.press(button(ar.common.save));
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect((await services.db.get("classes", cls.id))?.name).toBe("حلقة الضحى");
  });
});

describe("the class page", () => {
  it("shows a teacher the students, read-only", async () => {
    const services = createTestServices();
    const cls = await createClass(services.store, "حلقة الفجر");
    await createStudent(services.store, studentInput(cls.id, "أحمد علي"));
    params.mockReturnValue({ id: cls.id });
    await renderWithApp(<ClassScreen />, services);
    expect(await screen.findByText("أحمد علي")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: ar.students.add })).toBeNull();
    expect(screen.queryByRole("button", { name: ar.classes.rename })).toBeNull();
  });

  it("gives an admin the add button and the class menu", async () => {
    const services = admin();
    const cls = await createClass(services.store, "حلقة الفجر");
    params.mockReturnValue({ id: cls.id });
    await renderWithApp(<ClassScreen />, services);
    expect(await screen.findByText(ar.students.emptyTitle)).toBeOnTheScreen();
    await fireEvent.press(button(ar.students.add));
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/student-form",
      params: { classId: cls.id },
    });
    await fireEvent.press(button(ar.classes.archive));
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/archive-class",
      params: { id: cls.id },
    });
  });

  it("says when the class doesn't exist", async () => {
    params.mockReturnValue({ id: "missing" });
    await renderWithApp(<ClassScreen />);
    expect(await screen.findAllByText(ar.classes.notFound)).not.toHaveLength(0);
  });
});

describe("archiving a class", () => {
  it("with students and no other class, archives them with it", async () => {
    const services = admin();
    const cls = await createClass(services.store, "حلقة الفجر");
    await createStudent(services.store, studentInput(cls.id, "أحمد"));
    params.mockReturnValue({ id: cls.id });
    await renderWithApp(<ArchiveClassSheet />, services);
    expect(await screen.findByText(ar.classes.noOtherClass)).toBeOnTheScreen();
    await fireEvent.press(button(ar.classes.archiveAll));
    await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith("/"));
    expect((await services.db.get("classes", cls.id))?.archivedAt).not.toBeNull();
    const [student] = await services.db.all("students");
    expect(student?.archivedAt).not.toBeNull();
  });

  it("without students, just confirms", async () => {
    const services = admin();
    const cls = await createClass(services.store, "حلقة الفجر");
    params.mockReturnValue({ id: cls.id });
    await renderWithApp(<ArchiveClassSheet />, services);
    expect(await screen.findByText(ar.classes.archiveConfirm)).toBeOnTheScreen();
    await fireEvent.press(button(ar.classes.archive));
    await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith("/"));
    expect((await services.db.get("classes", cls.id))?.archivedAt).not.toBeNull();
  });
});

describe("the student form", () => {
  it("adds a student to the class, reading Arabic-Indic digits", async () => {
    const services = admin();
    const cls = await createClass(services.store, "حلقة الفجر");
    params.mockReturnValue({ classId: cls.id });
    await renderWithApp(<StudentFormScreen />, services);
    await fireEvent.changeText(screen.getByLabelText(ar.students.fullName), "أحمد علي");
    await fireEvent.changeText(screen.getByLabelText(ar.students.birthYear), "٢٠١٥");
    await fireEvent.press(screen.getByRole("radio", { name: ar.students.backward }));
    await fireEvent.press(button(ar.students.add));
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    const [student] = await services.db.all("students");
    expect(student).toMatchObject({
      classId: cls.id,
      fullName: "أحمد علي",
      birthYear: 2015,
      memorizationDirection: "backward",
      parentId: "",
    });
  });

  it("shows field errors and saves nothing", async () => {
    const services = admin();
    const cls = await createClass(services.store, "حلقة الفجر");
    params.mockReturnValue({ classId: cls.id });
    await renderWithApp(<StudentFormScreen />, services);
    await fireEvent.changeText(screen.getByLabelText(ar.students.parentId), "12");
    await fireEvent.press(button(ar.students.add));
    expect(await screen.findAllByText(ar.errors.validation.REQUIRED)).toHaveLength(2);
    expect(screen.queryByText(ar.students.parentIdHint)).toBeNull();
    expect(router.back).not.toHaveBeenCalled();
    expect(await services.db.count("students")).toBe(0);
  });
});

describe("the student page and search", () => {
  it("shows the student and the menu for those who manage students", async () => {
    const services = admin();
    const cls = await createClass(services.store, "حلقة الفجر");
    const student = await createStudent(services.store, studentInput(cls.id, "أحمد علي"));
    params.mockReturnValue({ id: student.id });
    await renderWithApp(<StudentScreen />, services);
    expect(await screen.findByText("حلقة الفجر")).toBeOnTheScreen();
    await fireEvent.press(button(ar.students.move));
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/move-student",
      params: { id: student.id },
    });
  });

  it("finds students ignoring hamza forms, and opens them in the search tab", async () => {
    const services = createTestServices();
    const cls = await createClass(services.store, "حلقة الفجر");
    const student = await createStudent(services.store, studentInput(cls.id, "أحمد علي"));
    await renderWithApp(<SearchScreen />, services);
    expect(screen.getByText(ar.search.hint)).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText(ar.search.placeholder), "احمد");
    await fireEvent.press(await screen.findByText("أحمد علي"));
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/search/student/[id]",
      params: { id: student.id },
    });
    await fireEvent.changeText(screen.getByLabelText(ar.search.placeholder), "خالد");
    expect(await screen.findByText(ar.search.noResults)).toBeOnTheScreen();
  });
});

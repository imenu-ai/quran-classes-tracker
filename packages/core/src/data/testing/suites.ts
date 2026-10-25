import { attendanceSuite } from "./attendance.suite";
import { classesSuite } from "./classes.suite";
import { storageContractSuite } from "./contract.suite";
import { engineSuite } from "./engine.suite";
import type { StorageFactory } from "./harness";
import { homeworkSuite } from "./homework.suite";
import { lessonsSuite } from "./lessons.suite";
import { localStoreSuite } from "./local-store.suite";
import { printSuite } from "./print.suite";
import { rejectedSuite } from "./rejected.suite";
import { studentsSuite } from "./students.suite";
import { todaySuite } from "./today.suite";

/**
 * Every shared data-layer test, on one adapter: the storage contract, then
 * LocalStore, the actions and queries, and sync. Each app runs these on its
 * own adapter, so the same rules are proven on every platform.
 */
export function dataLayerSuites(factory: StorageFactory) {
  storageContractSuite(factory);
  localStoreSuite(factory);
  classesSuite(factory);
  studentsSuite(factory);
  lessonsSuite(factory);
  attendanceSuite(factory);
  homeworkSuite(factory);
  todaySuite(factory);
  printSuite(factory);
  rejectedSuite(factory);
  engineSuite(factory);
}

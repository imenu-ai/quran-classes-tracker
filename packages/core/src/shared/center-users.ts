import type { Permission, Role } from "./access";

/** A user of the center as the admin sees it (GET /api/center/users). */
export interface CenterUser {
  id: string;
  name: string;
  username: string;
  phone: string;
  role: Role;
  permissions: Permission[];
  classIds: string[];
  disabled: boolean;
  mustChangePassword: boolean;
}

/** You first, then admins, then everyone else by name. */
export function sortCenterUsers(users: readonly CenterUser[], selfId: string): CenterUser[] {
  const rank = (user: CenterUser) => (user.id === selfId ? 0 : user.role === "admin" ? 1 : 2);
  return [...users].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

/** Each permission's message key under `users.permissions`. */
export const PERMISSION_MESSAGE_KEY: Record<
  Permission,
  "classesManage" | "studentsManage" | "lessonsRun" | "reportsView"
> = {
  "classes.manage": "classesManage",
  "students.manage": "studentsManage",
  "lessons.run": "lessonsRun",
  "reports.view": "reportsView",
};

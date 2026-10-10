import type { Db } from "mongodb";
import type { Access, Permission, Role } from "@/shared/access";
import { COLLECTIONS } from "./collections";

/**
 * What a user may do in his center. Kept apart from the Better Auth user so
 * no auth endpoint can ever change it; only the services in centers.ts do.
 */
export interface MemberDoc {
  /** The user's id. */
  _id: string;
  tenantId: string;
  role: Role;
  permissions: Permission[];
  classIds: string[];
  disabled: boolean;
  /** Set when an admin chose the password; cleared once the user changes it. */
  mustChangePassword: boolean;
  /** Bumped whenever role, permissions or classes change: devices then resync. */
  accessVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

export const membersCollection = (db: Db) => db.collection<MemberDoc>(COLLECTIONS.members);

export function getMember(db: Db, userId: string) {
  return membersCollection(db).findOne({ _id: userId });
}

export function accessOf(member: Pick<MemberDoc, "role" | "permissions" | "classIds">): Access {
  return { role: member.role, permissions: member.permissions, classIds: member.classIds };
}

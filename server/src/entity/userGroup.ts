export type UserGroupRole = 'admin' | 'viewer';

export interface UserGroup {
  id: number;
  name: string;
  createdBy: number;
  createdAt: number;
  updatedAt: number | null;
  deletedAt: number | null;
}

export interface UserGroupMember {
  id: number;
  groupId: number;
  userId: number;
  role: UserGroupRole;
  addedAt: number;
}

import { Permission, Role } from 'node-appwrite';

export function buildPrivateOwnerReadPermissions(accountId: string): string[] {
  return [Permission.read(Role.user(accountId))];
}

export function buildPublishedPostPermissions(accountId: string): string[] {
  return [
    Permission.read(Role.any()),
    Permission.update(Role.user(accountId)),
    Permission.delete(Role.user(accountId)),
  ];
}

export function buildPublishedPostMediaRowPermissions(): string[] {
  return [Permission.read(Role.any())];
}

export function buildPublishedPostMediaFilePermissions(): string[] {
  return [Permission.read(Role.any())];
}

export function buildStagedPostMediaFilePermissions(accountId: string): string[] {
  return [
    Permission.read(Role.user(accountId)),
    Permission.update(Role.user(accountId)),
    Permission.delete(Role.user(accountId)),
  ];
}

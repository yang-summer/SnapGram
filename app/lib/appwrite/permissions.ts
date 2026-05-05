import { Permission, Role } from 'appwrite';

export function buildPublicOwnerPermissions(accountId: string): string[] {
  return [
    Permission.read(Role.any()),
    Permission.update(Role.user(accountId)),
    Permission.delete(Role.user(accountId)),
  ];
}

export function buildPrivateOwnerReadPermissions(accountId: string): string[] {
  return [Permission.read(Role.user(accountId))];
}

export function buildPrivateStagedFilePermissions(accountId: string): string[] {
  return [
    Permission.read(Role.user(accountId)),
    Permission.update(Role.user(accountId)),
    Permission.delete(Role.user(accountId)),
  ];
}

import { Permission, Role } from 'appwrite';

export function buildPublicOwnerPermissions(accountId: string): string[] {
  return [
    Permission.read(Role.any()),
    Permission.update(Role.user(accountId)),
    Permission.delete(Role.user(accountId)),
  ];
}

export function buildPrivateOwnerPermissions(accountId: string): string[] {
  return [Permission.read(Role.user(accountId)), Permission.delete(Role.user(accountId))];
}

export function buildTransitionalPostPermissions(accountId: string): string[] {
  return [
    Permission.read(Role.any()),
    Permission.update(Role.users()),
    Permission.delete(Role.user(accountId)),
  ];
}

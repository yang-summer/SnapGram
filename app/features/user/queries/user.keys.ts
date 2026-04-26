export const userKeys = {
  all: ['users'] as const,
  profileRoot: () => [...userKeys.all, 'profile'] as const,
  scope: (profileId: string) => [...userKeys.profileRoot(), profileId] as const,
  publicProfile: (profileId: string) => [...userKeys.scope(profileId), 'public'] as const,
  editableProfile: (profileId: string) => [...userKeys.scope(profileId), 'editable'] as const,
};

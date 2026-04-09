export const userKeys = {
  all: ['users'] as const,
  saves: () => [...userKeys.all, 'saves'] as const,
  saveRecords: (profileId: string) => [...userKeys.saves(), profileId] as const,
};

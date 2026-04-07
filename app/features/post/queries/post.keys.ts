export const postKeys = {
  all: ['posts'] as const,
  lists: () => [...postKeys.all, 'list'] as const,
  recent: () => [...postKeys.lists(), 'recent'] as const,
};

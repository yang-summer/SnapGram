function normalizeSpace(value: string): string {
  return value.replace(/\s+/gu, ' ').trim();
}

function normalizeCaption(value: string): string {
  return normalizeSpace(value);
}

function normalizeTags(tags: string[]): string[] {
  return tags
    .map((tag) => normalizeSpace(tag.replace(/^#/u, '')))
    .filter((tag) => tag.length > 0);
}

export function buildPostSearchText(caption: string, tags: string[]): string | null {
  const normalizedCaption = normalizeCaption(caption);
  const normalizedTags = normalizeTags(tags);
  const parts = [
    normalizedCaption,
    ...normalizedTags,
  ].filter((part) => part.length > 0);

  if (parts.length === 0) {
    return null;
  }

  return normalizeSpace(parts.join(' '));
}

import type {
  EditableUserProfileViewModel,
  PublicUserProfileViewModel,
  UserProfileRecord,
} from '../types/user.type';

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = value.trim();

  return normalizedValue.length > 0 ? normalizedValue : null;
}

export function mapUserProfileRowToPublicViewModel(
  row: UserProfileRecord,
): PublicUserProfileViewModel {
  return {
    id: row.$id,
    name: normalizeOptionalText(row.name) ?? '',
    username: normalizeOptionalText(row.username) ?? '',
    imageUrl: row.imageUrl,
    bio: normalizeOptionalText(row.bio),
  };
}

export function mapUserProfileRowToEditableViewModel(
  row: UserProfileRecord,
): EditableUserProfileViewModel {
  return {
    id: row.$id,
    accountId: normalizeOptionalText(row.accountId) ?? '',
    email: normalizeOptionalText(row.email) ?? '',
    name: normalizeOptionalText(row.name) ?? '',
    username: normalizeOptionalText(row.username) ?? '',
    imageId: normalizeOptionalText(row.imageId),
    imageUrl: row.imageUrl,
    bio: normalizeOptionalText(row.bio),
  };
}

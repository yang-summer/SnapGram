import {
  deleteUserAvatarImage,
  getUserAvatarImageView,
  updateEditableUserProfile,
  uploadUserAvatar,
} from '../api/user.api';
import type {
  UpdateEditableUserProfileWithAvatarInput,
  UserProfileRecord,
} from '../types/user.type';

function assertEditableProfileUpdateInput(input: UpdateEditableUserProfileWithAvatarInput) {
  if (!input.profileId.trim()) {
    throw new Error('Profile ID is required to update an editable user profile.');
  }

  if (!input.ownerAccountId.trim()) {
    throw new Error('Owner account ID is required to update an editable user profile.');
  }

  if (!input.currentImageUrl.trim()) {
    throw new Error('Current image URL is required to update an editable user profile.');
  }
}

function assertAvatarFile(file: File) {
  if (file.size <= 0) {
    throw new Error('Selected user avatar file is empty.');
  }
}

async function cleanupUploadedAvatar(fileId: string | null, context: string): Promise<void> {
  if (!fileId) {
    return;
  }

  try {
    await deleteUserAvatarImage(fileId);
  } catch (error) {
    console.error(`[UserService.${context}] Failed to clean up uploaded user avatar.`, error);
  }
}

async function cleanupPreviousAvatar(
  currentImageId: string | null,
  nextImageId: string,
): Promise<void> {
  if (!currentImageId || currentImageId === nextImageId) {
    return;
  }

  try {
    await deleteUserAvatarImage(currentImageId);
  } catch (error) {
    console.error(
      '[UserService.updateEditableUserProfileWithAvatar] Failed to delete previous user avatar.',
      error,
    );
  }
}

export async function updateEditableUserProfileWithAvatar(
  input: UpdateEditableUserProfileWithAvatarInput,
): Promise<UserProfileRecord> {
  assertEditableProfileUpdateInput(input);

  const currentImageId = input.currentImageId;
  const nextAvatarFile = input.nextAvatarFile ?? null;

  if (!nextAvatarFile) {
    try {
      return await updateEditableUserProfile(input.profileId, {
        name: input.name,
        bio: input.bio ?? null,
        imageId: currentImageId,
        imageUrl: input.currentImageUrl,
      });
    } catch (error) {
      console.error(
        '[UserService.updateEditableUserProfileWithAvatar] Failed to update profile text.',
        error,
      );
      throw error;
    }
  }

  assertAvatarFile(nextAvatarFile);

  let uploadedAvatarFileId: string | null = null;

  try {
    const uploadedAvatarFile = await uploadUserAvatar(nextAvatarFile, input.ownerAccountId);
    uploadedAvatarFileId = uploadedAvatarFile.$id;

    const updatedProfile = await updateEditableUserProfile(input.profileId, {
      name: input.name,
      bio: input.bio ?? null,
      imageId: uploadedAvatarFileId,
      imageUrl: getUserAvatarImageView(uploadedAvatarFileId),
    });

    await cleanupPreviousAvatar(currentImageId, uploadedAvatarFileId);

    return updatedProfile;
  } catch (error) {
    await cleanupUploadedAvatar(uploadedAvatarFileId, 'updateEditableUserProfileWithAvatar');
    console.error(
      '[UserService.updateEditableUserProfileWithAvatar] Failed to update profile avatar.',
      error,
    );
    throw error;
  }
}

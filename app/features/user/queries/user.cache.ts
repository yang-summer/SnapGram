import type { QueryClient } from '@tanstack/react-query';
import { authKeys } from '~/features/auth/queries/auth.keys';
import type { CurrentUserDto, CurrentUserResult } from '~/features/auth/types/auth.type';
import { postKeys } from '~/features/post/queries/post.keys';
import type { EditableUserProfileViewModel, PublicUserProfileViewModel } from '../types/user.type';
import { userKeys } from './user.keys';

function mapEditableProfileToCurrentUser(
  updatedProfile: EditableUserProfileViewModel,
): CurrentUserDto {
  return {
    accountId: updatedProfile.accountId,
    profileId: updatedProfile.id,
    email: updatedProfile.email,
    name: updatedProfile.name,
    username: updatedProfile.username,
    imageUrl: updatedProfile.imageUrl,
    bio: updatedProfile.bio,
  };
}

function mapEditableProfileToPublicProfile(
  updatedProfile: EditableUserProfileViewModel,
): PublicUserProfileViewModel {
  return {
    id: updatedProfile.id,
    name: updatedProfile.name,
    username: updatedProfile.username,
    imageUrl: updatedProfile.imageUrl,
    bio: updatedProfile.bio,
  };
}

function buildNextCurrentUserResult(
  cachedCurrentUser: CurrentUserResult | undefined,
  updatedProfile: EditableUserProfileViewModel,
): CurrentUserResult | null {
  if (cachedCurrentUser?.status !== 'authenticated') {
    return null;
  }

  if (cachedCurrentUser.user.profileId !== updatedProfile.id) {
    return null;
  }

  return {
    ...cachedCurrentUser,
    user: mapEditableProfileToCurrentUser(updatedProfile),
  };
}

// 在资料更新成功后、回填缓存之前，先取消可能仍在飞行中的身份相关请求。
// 这样可以降低旧响应晚到后覆盖新缓存的竞态风险。
export async function cancelUpdatedProfileIdentityQueries(
  queryClient: QueryClient,
  profileId: string,
): Promise<void> {
  const normalizedProfileId = profileId.trim();

  if (normalizedProfileId.length === 0) {
    return;
  }

  await Promise.all([
    queryClient.cancelQueries({
      queryKey: authKeys.currentUser(),
      exact: true,
    }),
    queryClient.cancelQueries({
      queryKey: userKeys.publicProfile(normalizedProfileId),
      exact: true,
    }),
    queryClient.cancelQueries({
      queryKey: userKeys.editableProfile(normalizedProfileId),
      exact: true,
    }),
  ]);
}

// 仅当更新的 profile 就是当前登录用户本人时，直接回填 auth.currentUser。
// 这样侧边栏、底栏等依赖当前用户缓存的区域可以立即显示新头像和新名字。
export function backfillCurrentUserCache(
  queryClient: QueryClient,
  updatedProfile: EditableUserProfileViewModel,
): void {
  const nextCurrentUser = buildNextCurrentUserResult(
    queryClient.getQueryData<CurrentUserResult>(authKeys.currentUser()),
    updatedProfile,
  );

  if (!nextCurrentUser) {
    return;
  }

  queryClient.setQueryData<CurrentUserResult>(authKeys.currentUser(), nextCurrentUser);
}

// 将 mutation 返回的最新资料快照直接写回 public / editable 两类资料缓存。
// 这样编辑页本身和跳回后的资料页头部都能立即拿到新数据，而不必等待额外 refetch。
export function backfillUserProfileCaches(
  queryClient: QueryClient,
  updatedProfile: EditableUserProfileViewModel,
): void {
  const normalizedProfileId = updatedProfile.id.trim();

  if (normalizedProfileId.length === 0) {
    return;
  }

  queryClient.setQueryData<PublicUserProfileViewModel>(
    userKeys.publicProfile(normalizedProfileId),
    mapEditableProfileToPublicProfile(updatedProfile),
  );
  queryClient.setQueryData<EditableUserProfileViewModel>(
    userKeys.editableProfile(normalizedProfileId),
    {
      ...updatedProfile,
      id: normalizedProfileId,
    },
  );
}

// 对帖子展示相关缓存采用“定向失效”而不是深层 patch。
// 这里只标记帖子列表、详情和资料页 feed scope 为 stale，让活跃页面自动刷新，
// 同时避免误伤 viewer like/save 这类与资料编辑无关的互动状态缓存。
export async function invalidateUpdatedProfilePresentationCaches(
  queryClient: QueryClient,
  profileId: string,
): Promise<void> {
  const normalizedProfileId = profileId.trim();

  if (normalizedProfileId.length === 0) {
    return;
  }

  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: postKeys.lists(),
    }),
    queryClient.invalidateQueries({
      queryKey: postKeys.details(),
    }),
    queryClient.invalidateQueries({
      queryKey: postKeys.profileScope(normalizedProfileId),
    }),
  ]);
}

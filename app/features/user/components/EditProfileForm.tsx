import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import type { input } from 'zod';
import InlineErrorAlert from '~/components/feedback/inline-error-alert';
import { Button } from '~/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { Textarea } from '~/components/ui/textarea';
import { EditProfileValidation } from '~/lib/validation';
import AvatarUploader from './AvatarUploader';
import { useUpdateEditableUserProfileMutation } from '../queries/user.mutations';
import type {
  EditableUserProfileFormValues,
  EditableUserProfileViewModel,
} from '../types/user.type';

type EditProfileFormProps = {
  profile: EditableUserProfileViewModel;
};

type EditProfileFormInputValues = input<typeof EditProfileValidation>;

function getDefaultValues(profile: EditableUserProfileViewModel): EditableUserProfileFormValues {
  return {
    name: profile.name,
    bio: profile.bio ?? '',
    avatarFile: null,
  };
}

function normalizeName(value: string): string {
  return value.trim();
}

function normalizeBio(value: string): string | null {
  const normalizedValue = value.trim();

  return normalizedValue.length > 0 ? normalizedValue : null;
}

function getProfileEditErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Failed to save your profile changes. Please try again.';
}

function hasEditableProfileChanges(
  values: EditableUserProfileFormValues,
  profile: EditableUserProfileViewModel,
): boolean {
  if (values.avatarFile !== null) {
    return true;
  }

  if (normalizeName(values.name) !== profile.name) {
    return true;
  }

  return normalizeBio(values.bio) !== profile.bio;
}

export default function EditProfileForm({ profile }: EditProfileFormProps) {
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { mutateAsync: updateProfile, isPending: isUpdatingProfile } =
    useUpdateEditableUserProfileMutation();
  const form = useForm<EditProfileFormInputValues, unknown, EditableUserProfileFormValues>({
    resolver: zodResolver(EditProfileValidation),
    defaultValues: getDefaultValues(profile),
  });
  const watchedName = useWatch({
    control: form.control,
    name: 'name',
  });
  const watchedBio = useWatch({
    control: form.control,
    name: 'bio',
  });
  const watchedAvatarFile = useWatch({
    control: form.control,
    name: 'avatarFile',
  });
  const hasChanges = hasEditableProfileChanges(
    {
      name: watchedName ?? '',
      bio: watchedBio ?? '',
      avatarFile: watchedAvatarFile ?? null,
    },
    profile,
  );
  const isSubmitDisabled = isUpdatingProfile || !hasChanges;

  useEffect(() => {
    if (!submitError) {
      return;
    }

    setSubmitError(null);
  }, [submitError, watchedAvatarFile, watchedBio, watchedName]);

  async function onSubmit(values: EditableUserProfileFormValues) {
    setSubmitError(null);

    if (!hasEditableProfileChanges(values, profile)) {
      return;
    }

    try {
      await updateProfile({
        profileId: profile.id,
        ownerAccountId: profile.accountId,
        name: normalizeName(values.name),
        bio: normalizeBio(values.bio),
        currentImageId: profile.imageId,
        currentImageUrl: profile.imageUrl,
        nextAvatarFile: values.avatarFile,
      });

      toast.success('Profile updated successfully.');
      navigate(`/profile/${profile.id}/posts`, { replace: true });
    } catch (error) {
      setSubmitError(getProfileEditErrorMessage(error));
    }
  }

  function handleCancel() {
    navigate(`/profile/${profile.id}/posts`);
  }

  return (
    <form id="form-editProfile" onSubmit={form.handleSubmit(onSubmit)} className="w-full max-w-4xl">
      <FieldGroup className="gap-8">
        {submitError ? (
          <InlineErrorAlert title="Unable to update profile" message={submitError} />
        ) : null}

        <div className="rounded-3xl border bg-card p-6 shadow-sm">
          <Controller
            name="avatarFile"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="w-full">
                <FieldLabel>Avatar</FieldLabel>
                <AvatarUploader
                  currentImageUrl={profile.imageUrl}
                  value={field.value ?? null}
                  onChange={field.onChange}
                  disabled={isUpdatingProfile}
                  alt={`${profile.name} avatar preview`}
                />
                <FieldDescription>
                  Choose a new profile photo now, then save to apply it.
                </FieldDescription>
                {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
              </Field>
            )}
          />
        </div>

        <div className="rounded-3xl border bg-card p-6 shadow-sm">
          <FieldGroup className="gap-6">
            <Field className="w-full">
              <FieldLabel htmlFor="form-editProfile-email">Email</FieldLabel>
              <Input
                id="form-editProfile-email"
                type="email"
                value={profile.email}
                readOnly
                disabled
              />
              <FieldDescription>
                Email is shown for reference only and cannot be changed here.
              </FieldDescription>
            </Field>

            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="w-full">
                  <FieldLabel htmlFor="form-editProfile-name">Name</FieldLabel>
                  <Input
                    {...field}
                    id="form-editProfile-name"
                    type="text"
                    aria-invalid={fieldState.invalid}
                    autoComplete="off"
                    disabled={isUpdatingProfile}
                  />
                  {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                </Field>
              )}
            />

            <Controller
              name="bio"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="w-full">
                  <FieldLabel htmlFor="form-editProfile-bio">Bio</FieldLabel>
                  <Textarea
                    {...field}
                    id="form-editProfile-bio"
                    aria-invalid={fieldState.invalid}
                    autoComplete="off"
                    rows={5}
                    disabled={isUpdatingProfile}
                    placeholder="Tell people a little about yourself."
                  />
                  <FieldDescription>
                    Short bios work best. Leave it empty if you prefer no bio.
                  </FieldDescription>
                  {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                </Field>
              )}
            />
          </FieldGroup>
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            className="cursor-pointer"
            onClick={handleCancel}
            disabled={isUpdatingProfile}
          >
            Cancel
          </Button>
          <Button type="submit" className="cursor-pointer" disabled={isSubmitDisabled}>
            {isUpdatingProfile ? 'Saving...' : 'Save changes'}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}

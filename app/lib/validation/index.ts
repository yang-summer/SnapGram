import * as z from 'zod';

export const EDIT_PROFILE_AVATAR_MAX_SIZE_BYTES = 5 * 1024 * 1024;
export const EDIT_PROFILE_BIO_MAX_LENGTH = 512;

function isFileLike(value: unknown): value is File {
  if (typeof File !== 'undefined' && value instanceof File) {
    return true;
  }

  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    'size' in value &&
    'type' in value
  );
}

const EditProfileAvatarValidation = z
  .custom<File | null | undefined>((value) => value == null || isFileLike(value), {
    message: 'Please choose a valid avatar file.',
  })
  .refine((value) => value == null || value.size > 0, {
    message: 'Selected avatar file is empty.',
  })
  .refine((value) => value == null || value.type.startsWith('image/'), {
    message: 'Please choose an image file.',
  })
  .refine((value) => value == null || value.size <= EDIT_PROFILE_AVATAR_MAX_SIZE_BYTES, {
    message: 'Avatar image must be 5MB or smaller.',
  })
  .transform((value) => value ?? null);

export const SignupValidation = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters.')
    .max(32, 'Name must be at most 32 characters.'),
  username: z
    .string()
    .min(2, 'Username must be at least 2 characters.')
    .max(32, 'Username must be at most 32 characters.'),
  email: z.email(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(16, 'Password must be at most 16 characters.'),
});

export const SigninValidation = z.object({
  email: z.email(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(16, 'Password must be at most 16 characters.'),
});

export const PostValidation = z.object({
  caption: z
    .string()
    .min(5, { message: 'Minimum 5 characters.' })
    .max(2200, { message: 'Maximum 2,200 caracters' }),
  file: z.custom<File[]>(),
  location: z
    .string()
    .min(1, { message: 'This field is required' })
    .max(1000, { message: 'Maximum 1000 characters.' }),
  tags: z.string(),
});

export const EditProfileValidation = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters.')
    .max(32, 'Name must be at most 32 characters.'),
  bio: z
    .string()
    .max(EDIT_PROFILE_BIO_MAX_LENGTH, `Bio must be at most ${EDIT_PROFILE_BIO_MAX_LENGTH} characters.`),
  avatarFile: EditProfileAvatarValidation,
});

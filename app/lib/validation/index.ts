import * as z from 'zod';

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

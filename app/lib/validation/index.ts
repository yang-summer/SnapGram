import * as z from 'zod';

export const signupValidation = z.object({
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

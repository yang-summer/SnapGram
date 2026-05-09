import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import * as z from 'zod';
import InlineErrorAlert from '~/components/feedback/inline-error-alert';
import { Button } from '~/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { useSignInMutation } from '~/features/auth/queries/auth.mutations';
import { SigninValidation } from '~/lib/validation';

const PROFILE_RECOVERY_MESSAGE =
  'You are signed in, but your profile is not fully initialized yet. Please complete recovery before continuing.';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Sign in failed. Please try again.';
}

export default function SigninForm() {
  const navigate = useNavigate();
  const { mutateAsync: signIn, isPending: isSigningIn } = useSignInMutation();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<z.infer<typeof SigninValidation>>({
    resolver: zodResolver(SigninValidation),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(data: z.infer<typeof SigninValidation>) {
    setSubmitError(null);

    try {
      const currentUser = await signIn({
        email: data.email,
        password: data.password,
      });

      if (currentUser.status === 'authenticated') {
        form.reset();
        navigate('/', { replace: true });
        return;
      }

      if (currentUser.status === 'profile_missing') {
        navigate('/', {
          replace: true,
          state: {
            recoveryMessage: PROFILE_RECOVERY_MESSAGE,
          },
        });
        return;
      }

      setSubmitError('Sign in failed. Please try again.');
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    }
  }

  return (
    <form
      id="form-signin"
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex flex-col items-center w-full max-w-md gap-8 px-4 sm:px-6"
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex items-center gap-1">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-700">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"></path>
              <path d="M20 2v4"></path>
              <path d="M22 4h-4"></path>
              <circle cx="4" cy="20" r="2"></circle>
            </svg>
          </div>
          <span className="text-2xl font-black text-blue-700">Snapgram</span>
        </div>
        <h2 className="text-xl font-bold">Log in to your account</h2>
        <p className="text-xs sm:text-sm">To use Snapgram please enter your details</p>
      </div>
      <FieldGroup className="flex flex-col items-center gap-5">
        {submitError ? (
          <InlineErrorAlert
            title="Sign in failed"
            message={submitError}
            className="w-full max-w-xs"
          />
        ) : null}
        <Controller
          name="email"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="w-full max-w-xs">
              <FieldLabel htmlFor="form-signin-email">Email</FieldLabel>
              <Input
                {...field}
                type="email"
                id="form-signin-email"
                aria-invalid={fieldState.invalid}
                placeholder=""
                autoComplete="off"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="password"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="w-full max-w-xs">
              <FieldLabel htmlFor="form-signin-password">Password</FieldLabel>
              <Input
                {...field}
                type="password"
                id="form-signin-password"
                aria-invalid={fieldState.invalid}
                placeholder=""
                autoComplete="off"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>
      <Button type="submit" className="w-full max-w-xs rounded-full" disabled={isSigningIn}>
        {isSigningIn ? 'Signing in...' : 'Submit'}
      </Button>
      <p className="text-center">
        Don't have an account?
        <Link to="/sign-up" className="text-primary ml-1">
          Sign up
        </Link>
      </p>
    </form>
  );
}

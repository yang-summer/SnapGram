import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import * as z from 'zod';
import { Button } from '~/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { useUserContext } from '~/context/AuthContext';
import { useSignInAccountMutation } from '~/lib/react-query/queriesAndMutations';
import { signinValidation } from '~/lib/validation';

export default function SigninForm() {
  const navigate = useNavigate();
  const { checkAuthUser, isLoading: isUserLoading } = useUserContext();
  const { mutateAsync: signInAccount, isPending: isSigningIn } = useSignInAccountMutation();

  const form = useForm<z.infer<typeof signinValidation>>({
    resolver: zodResolver(signinValidation),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(data: z.infer<typeof signinValidation>) {
    const session = await signInAccount({
      email: data.email,
      password: data.password,
    });

    if (!session) {
      console.error('Sign in failed');
    }

    const isLoggedIn = await checkAuthUser();

    if (isLoggedIn) {
      form.reset();
      navigate('/');
    } else {
      console.error('Sign in failed');
    }
  }

  return (
    <form
      id="form-signin"
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex flex-col items-center w-full max-w-md gap-8 px-4 sm:px-6"
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <img src="/assets/images/logo.svg" />
        <h2 className="text-xl font-bold">Log in to your account</h2>
        <p className="text-xs sm:text-sm">To use Snapgram please enter your details</p>
      </div>
      <FieldGroup className="flex flex-col items-center gap-5">
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
      <Button type="submit" className="w-full max-w-xs rounded-full">
        Submit
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

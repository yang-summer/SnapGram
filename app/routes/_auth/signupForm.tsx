import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import * as z from 'zod';
import { Button } from '~/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { useUserContext } from '~/context/AuthContext';
import {
  useCreateUserAccountMutation,
  useSignInAccountMutation,
} from '~/lib/react-query/queriesAndMutations';
import { signupValidation } from '~/lib/validation';

export default function SignupForm() {
  const navigate = useNavigate();
  const { checkAuthUser, isLoading: isUserLoading } = useUserContext();
  const { mutateAsync: createAccount, isPending: isCreatingAccount } =
    useCreateUserAccountMutation();
  const { mutateAsync: signInAccount, isPending: isSigningIn } = useSignInAccountMutation();

  const form = useForm<z.infer<typeof signupValidation>>({
    resolver: zodResolver(signupValidation),
    defaultValues: {
      name: '',
      username: '',
      email: '',
      password: '',
    },
  });

  async function onSubmit(data: z.infer<typeof signupValidation>) {
    const newUser = await createAccount(data);

    if (!newUser) {
      console.error('Sign up failed');
    }

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
      console.error('Sign up failed');
    }
  }

  return (
    <form
      id="form-signup"
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex flex-col items-center w-full max-w-md gap-8 px-4 sm:px-6"
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <img src="/assets/images/logo.svg" />
        <h2 className="text-xl font-bold">Create a new account</h2>
        <p className="text-xs sm:text-sm">To use Snapgram please enter your details</p>
      </div>
      <FieldGroup className="flex flex-col items-center gap-5">
        <Controller
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="w-full max-w-xs">
              <FieldLabel htmlFor="form-signup-name">Name</FieldLabel>
              <Input
                {...field}
                type="text"
                id="form-signup-name"
                aria-invalid={fieldState.invalid}
                placeholder=""
                autoComplete="off"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="username"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="w-full max-w-xs">
              <FieldLabel htmlFor="form-signup-username">Username</FieldLabel>
              <Input
                {...field}
                type="text"
                id="form-signup-username"
                aria-invalid={fieldState.invalid}
                placeholder=""
                autoComplete="off"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="email"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="w-full max-w-xs">
              <FieldLabel htmlFor="form-signup-email">Email</FieldLabel>
              <Input
                {...field}
                type="email"
                id="form-signup-email"
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
              <FieldLabel htmlFor="form-signup-password">Password</FieldLabel>
              <Input
                {...field}
                type="password"
                id="form-signup-password"
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
        Already have an account?
        <Link to="/sign-in" className="text-primary ml-1">
          Log in
        </Link>
      </p>
    </form>
  );
}

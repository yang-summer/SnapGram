import type { RouteConfig } from '@react-router/dev/routes';
import { index, layout, route } from '@react-router/dev/routes';

export default [
  layout('layouts/rootLayout.tsx', [index('routes/home.tsx')]),
  layout('layouts/authLayout.tsx', [
    route('sign-in', 'routes/_auth/signinForm.tsx'),
    route('sign-up', 'routes/_auth/signupForm.tsx'),
  ]),
] satisfies RouteConfig;

import type { RouteConfig } from '@react-router/dev/routes';
import { index, layout, route } from '@react-router/dev/routes';

export default [
  layout('layouts/rootLayout.tsx', [
    index('routes/home.tsx'),
    route('explore', 'routes/explore.tsx'),
    route('saved', 'routes/saved.tsx'),
    route('all-users', 'routes/allUsers.tsx'),
    route('create-post', 'routes/createPost.tsx'),
    route('update-post/:id', 'routes/editPost.tsx'),
    route('posts/:id', 'routes/postDetails.tsx'),
    route('profile/:id/*', 'routes/profile.tsx'),
    route('update-profile/:id', 'routes/updateProfile.tsx'),
  ]),
  layout('layouts/authLayout.tsx', [
    route('sign-in', 'routes/_auth/signinForm.tsx'),
    route('sign-up', 'routes/_auth/signupForm.tsx'),
  ]),
] satisfies RouteConfig;

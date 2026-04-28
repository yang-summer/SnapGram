import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tailwindcss(),
    reactRouter(),
    tsconfigPaths({
      // The frontend only uses the root tsconfig path aliases.
      // Restricting discovery avoids Vite reacting to Appwrite's
      // temporary tsconfig files under functions/.appwrite/tmp-build.
      projects: ['./tsconfig.json'],
    }),
  ],
  server: {
    watch: {
      ignored: [
        // Backend function changes should not trigger frontend HMR/full reload.
        '**/functions/**',
      ],
    },
  },
});

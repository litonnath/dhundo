import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Separate app, separate build, separate origin. It shares only the Supabase
// project with ShortlistOne -- no imports cross between the two codebases, so
// a change here can never break the hiring platform.
export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist", sourcemap: false },
});

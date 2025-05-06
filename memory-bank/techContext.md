# Tech Context

## Technologies Used

- **Framework:** SvelteKit (for Server-Side Rendering - SSR)
- **Language:** TypeScript
- **Backend-as-a-Service (BaaS):** Supabase
  - **Authentication:** Supabase Auth (Email/Password, OAuth, Password Reset with PKCE)
  - **Database:** Supabase PostgreSQL
- **Styling:**
  - Tailwind CSS (Primary styling framework)
  - Basic CSS (as per `app.css`, potentially for global styles or fallbacks)
- **UI Components:** shadcn-svelte (Component library)
- **Icons:** @lucide/svelte
- **Key Libraries:**
  - `@supabase/ssr`: For handling Supabase authentication in SvelteKit SSR environments.
  - `@supabase/supabase-js`: Core Supabase client library.

## Development Setup

- **Environment Variables:** Requires `.env` file with:
  - `PUBLIC_SUPABASE_URL`: Supabase project URL.
  - `PUBLIC_SUPABASE_ANON_KEY`: Supabase project anonymous key.
- **SvelteKit Project:** Standard SvelteKit project structure, configured with Tailwind CSS and shadcn-svelte.
- **Supabase Project:** A configured Supabase project with appropriate tables, RLS policies, and authentication settings (including email templates and OAuth providers if used).

## Technical Constraints

- **SSR Environment:** Logic must correctly handle server-side and client-side execution contexts, particularly for authentication and data fetching.
- **Cookie-based Sessions:** Supabase SSR relies on cookies for session management.
- **RLS Dependency:** Data security heavily relies on Row Level Security (RLS) policies in Supabase, supplemented by server-side checks in SvelteKit actions.
- **Progressive Enhancement:** Forms are designed to work with and without JavaScript using SvelteKit's `use:enhance`.

## Dependencies

- `@supabase/ssr`: Crucial for integrating Supabase auth with SvelteKit's SSR model.
- `@supabase/supabase-js`: General Supabase client.
- `svelte`: Core Svelte library.
- `@sveltejs/kit`: SvelteKit framework.
- `typescript`: For static typing.
- `tailwindcss`: Utility-first CSS framework.
- `shadcn-svelte`: Component library.
- `@lucide/svelte`: Icon library. 
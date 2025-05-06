# System Patterns

## System Architecture Overview

The application follows a Server-Side Rendering (SSR) architecture using SvelteKit. Supabase serves as the Backend-as-a-Service (BaaS), providing authentication and a PostgreSQL database.

- **Client-Side (Browser):** Svelte components render the UI. Client-side Supabase client interacts with Supabase for dynamic updates and real-time features (if any). Handles user input and navigation.
- **Server-Side (SvelteKit):**
  - Handles initial page loads and API-like endpoints (form actions, server routes).
  - `hooks.server.ts`: Manages Supabase client initialization per request and implements authentication guards.
  - `+page.server.ts` / `+layout.server.ts`: Contain `load` functions for server-side data fetching and `actions` for CUD operations.
  - Uses a server-side Supabase client to interact securely with the database, enforcing RLS.
- **Supabase (Backend):**
  - **Auth:** Manages user identities, sessions, and provides mechanisms like OAuth and password reset.
  - **Database (PostgreSQL):** Stores application data (users, items, categories, tags, etc.). Row Level Security (RLS) policies are critical for data protection.

## Key Technical Decisions

- **SvelteKit for SSR:** Chosen for its modern features, performance, and integrated approach to building full-stack applications with TypeScript.
- **Supabase as BaaS:** Simplifies backend development by providing ready-to-use authentication, database, and other services. `@supabase/ssr` library is key for SvelteKit integration.
- **TypeScript for Type Safety:** Enhances code quality, maintainability, and developer experience.
- **Server-Side Data Operations:** Prioritizing server `load` functions for data fetching and server `actions` for mutations (Create, Update, Delete) to ensure security (RLS enforcement) and data integrity.
- **Progressive Enhancement for Forms:** Using SvelteKit's `use:enhance` to ensure forms are functional even if JavaScript fails or is disabled, and to provide a smoother UX when JavaScript is available.
- **RLS as Primary Data Security:** Relying on Supabase's Row Level Security as the main mechanism for controlling data access, supplemented by checks in server-side code.

## Design Patterns in Use

- **Model-View-Controller (MVC)-like (adapted for SvelteKit):**
  - **Model:** Supabase database schema and data access logic (within `load` functions and `actions`).
  - **View:** Svelte components (`.svelte` files) responsible for rendering the UI.
  - **Controller:** SvelteKit `actions`, `load` functions, and server hooks (`hooks.server.ts`) that handle user requests, interact with the model, and prepare data for the view.
- **Server-Side Rendering (SSR):** Improves initial page load performance and SEO.
- **Layout System (SvelteKit):** `+layout.svelte`, `+layout.ts`, `+layout.server.ts` files define shared UI and logic for routes.
- **Protected Routes / Auth Guards:** Implemented in `hooks.server.ts` to restrict access to certain parts of the application based on authentication status.
- **Dependency Injection (via `event.locals`):** The Supabase client and session/user data are made available to server-side code via `event.locals`.
- **Progressive Enhancement:** Forms are built to be functional without client-side JavaScript, with `use:enhance` improving the experience when JS is active.

## Component Relationships

- **`src/app.html`:** Main HTML shell.
- **`src/hooks.server.ts`:** Intercepts all server requests. Initializes Supabase client (`supabase` handle), provides `safeGetSession`, and performs authentication checks/redirects (`authGuard` handle).
- **`src/routes/+layout.server.ts`:** Root server layout, fetches initial session/user data using `safeGetSession()`, passes it to `+layout.ts`.
- **`src/routes/+layout.ts`:** Root layout, initializes client-side Supabase client, receives server data, and makes `supabase`, `session`, `user` available to all pages/layouts via SvelteKit's data flow.
- **`src/routes/+layout.svelte`:** Root Svelte layout, sets up `onAuthStateChange` listener for reactivity, renders child routes.
- **Page Components (`src/routes/**/+page.svelte`):** Display page content, receive data from corresponding `load` functions (via `data` prop) and form action results (via `form` prop). Interact with server actions via HTML forms enhanced with `use:enhance`.
- **Server Modules (`src/routes/**/+page.server.ts`):**
  - `load` functions: Fetch data from Supabase for specific pages.
  - `actions`: Handle form submissions for Create, Update, Delete operations against Supabase.
- **Reusable UI Components (`src/lib/components/*.svelte`):** Encapsulate specific UI elements or forms (e.g., `ItemForm.svelte`), receive data and action results as props.
- **Authentication Routes (`src/routes/auth/**`):**
  - `+page.svelte` & `+page.server.ts`: Handle UI and logic for login, registration, password reset requests.
  - `/callback/+server.ts`: Handles OAuth callbacks.
  - `/confirm/+server.ts`: Handles email confirmation/PKCE flow callbacks.
- **Protected Routes (`src/routes/app/**`):** Application core features, access controlled by `authGuard`. 
# Supabase Authentication Implementation Summary (SvelteKit SSR)

This document summarizes how Supabase authentication is set up and managed within this SvelteKit project, utilizing the Supabase SSR library (`@supabase/ssr`).

## Core Concepts & Setup

1.  **Supabase SSR Library (`@supabase/ssr`):** This library is crucial for handling authentication securely in server-side rendering (SSR) environments like SvelteKit. It provides helpers to create Supabase clients that correctly manage session information using cookies on both the server and the client.

2.  **Environment Variables:**
    *   `PUBLIC_SUPABASE_URL`: Your Supabase project URL.
    *   `PUBLIC_SUPABASE_ANON_KEY`: Your Supabase project's anonymous key.
    *   These are typically stored in a `.env` file and accessed via `$env/static/public`. **Never expose your service role key.**

3.  **Initialization & Client Creation:**
    *   **Server-Side (Hooks):** In `src/hooks.server.ts`, `createServerClient` is used within the `supabase` handle hook. This creates a Supabase client instance specific to each incoming server request. It's configured to read cookies from the request and write them back to the response, ensuring session persistence.
    *   **Server-Side (Layouts/Pages):** The Supabase client initialized in hooks is attached to `event.locals.supabase`, making it available in `+page.server.ts` and `+layout.server.ts` files via the `event` object (e.g., `event.locals.supabase`).
    *   **Client-Side (Layouts):** In `src/routes/+layout.ts`, both `createServerClient` (for initial server load) and `createBrowserClient` (for client-side navigation) are used. This ensures a seamless client-side experience. The server cookies (`data.cookies`) are passed down from `+layout.server.ts` to hydrate the client-side instance initially. `depends('supabase:auth')` is crucial for reactivity when the auth state changes.

## Accessing Session & User Data

Knowing if a user is authenticated and accessing their data is handled differently on the server and client.

1.  **Server-Side (`.server.ts` files, Hooks):**
    *   **`event.locals.safeGetSession()`:** This helper function (defined in `src/hooks.server.ts`) is the **recommended** way to get session and user data *on the server*. It first calls `getSession()` (reads from cookies) and then `getUser()` (validates the JWT against Supabase). This ensures you have a *validated* session. It returns `{ session, user }`. If the session is invalid or non-existent, both will be `null`.
    *   **`event.locals.session` & `event.locals.user`:** These are populated by the `authGuard` hook in `src/hooks.server.ts` after calling `safeGetSession()`. They provide convenient access to the validated session and user objects within subsequent hooks or server-side load functions. Access them directly (e.g., `if (event.locals.session) { ... }`).

2.  **Client-Side (`.svelte` files):**
    *   **Root Layout Data:** The root server layout (`src/routes/+layout.server.ts`) uses `safeGetSession()` to get the validated session and user data.
    *   **Passing Data Down:** This `{ session, user }` data is returned from the `load` function in `+layout.server.ts`.
    *   **Client-Side Hydration:** The root layout load function (`src/routes/+layout.ts`) receives this server data as `data.session` and `data.user`. It also initializes the client-side Supabase client.
    *   **Accessing in Components:** In any `.svelte` page or layout component, you access the session and user data passed down from the root layout:
        ```svelte
        <script lang="ts">
          let { data } = $props();
          // session and user are derived from the root layout data
          let { session, user, supabase } = $derived(data);

          // Check if user is logged in
          $: isLoggedIn = !!session; 
          // Or directly check if user object exists
          $: isAlsoLoggedIn = !!user; 
        </script>

        {#if session}
          <p>Welcome, {user?.email}!</p> 
          {/* Use user?.email for type safety */}
        {:else}
          <p>Please log in.</p>
        {/if}
        ```
    *   **Reactivity:** The `onAuthStateChange` listener in `src/routes/+layout.svelte` automatically calls `invalidate('supabase:auth')` when the authentication state changes (login, logout, token refresh). This triggers SvelteKit to re-run the `load` functions that depend on `'supabase:auth'` (specifically the root `+layout.ts`), updating the `session` and `user` props throughout your application automatically.

## Key Files & Their Roles

*   **`src/hooks.server.ts`:**
    *   `supabase` handle: Initializes the server-side Supabase client for each request using cookies. Defines `event.locals.safeGetSession`.
    *   `authGuard` handle: Runs after `supabase`. Checks authentication status using `safeGetSession()`. Redirects users based on their login status and the route they are trying to access (protects `/app`, redirects logged-in users away from non-essential `/auth` routes). Populates `event.locals.session` and `event.locals.user`.
    *   `sequence`: Ensures `supabase` runs before `authGuard`.
*   **`src/routes/+layout.server.ts`:**
    *   Runs on the server for *every* route.
    *   Calls `safeGetSession()` to get the validated session/user.
    *   Returns `{ session, user, cookies }` to make them available to `+layout.ts` and subsequently to all client-side components.
*   **`src/routes/+layout.ts`:**
    *   Runs first on the server, then on the client during navigation.
    *   Initializes the Supabase client (server or browser variant).
    *   Uses `depends('supabase:auth')` for reactivity.
    *   Retrieves session/user data (`data.session`, `data.user`) passed from the server load.
    *   Makes `{ supabase, session, user }` available to child layouts/pages.
*   **`src/routes/+layout.svelte`:**
    *   Sets up the `onAuthStateChange` listener to invalidate the layout data upon auth changes, ensuring UI updates.
    *   Renders child components (`{@render children()}`).
*   **`src/routes/auth/+page.server.ts`:**
    *   Contains SvelteKit form actions (`login`, `register`, `reset_password`, `oauth_login`) that interact with `supabase.auth` methods.
    *   The `register` action includes server-side validation to ensure the provided password and password confirmation match.
*   **`src/routes/auth/callback/+server.ts`:**
    *   Handles the redirect callback for **OAuth** providers. Exchanges the `code` received from the provider for a user session using `supabase.auth.exchangeCodeForSession()`.
    *   Handles redirects for some other email link types (e.g., email change confirmation) *if* they are configured to point here. **Password Reset is NOT handled here anymore.**
*   **`src/routes/auth/confirm/+server.ts`:**
    *   Handles the redirect callback specifically for **email link verification** using the PKCE flow (Password Reset, potentially Magic Link, Signup Confirmation if configured).
    *   Receives a `token_hash` and `type`.
    *   Verifies the token using `supabase.auth.verifyOtp()`.
    *   Redirects to the URL specified in the `next` query parameter (e.g., `/auth/update-password` for recovery) on success.
*   **`src/routes/auth/update-password/+page.svelte`:**
    *   The page where users land after clicking a valid password reset link (via `/auth/confirm`).
    *   Users enter their new password here.
    *   The form submission calls `supabase.auth.updateUser({ password: newPassword })` to update the already authenticated user's password.
*   **`src/routes/app/**`:**
    *   Contains protected routes. Access is controlled by the `authGuard` in `hooks.server.ts`.
    *   The empty `src/routes/app/+layout.ts` ensures these routes are dynamic and always run the server hooks.

## Authentication Flows Summary

1.  **Email/Password Login:**
    *   User interacts with the Sign In form (`/auth/+page.svelte`, when `isSignUp` state is `false`).
    *   Submits email/password.
    *   `login` action (`/auth/+page.server.ts`) calls `supabase.auth.signInWithPassword()`.
    *   On success, Supabase sets cookies, and the action redirects to `/app`. Hooks handle session validation on subsequent requests.
2.  **Email/Password Signup:**
    *   User interacts with the Sign Up form (`/auth/+page.svelte`, when `isSignUp` state is `true`).
    *   Submits email, password, and password confirmation.
    *   Client-side validation in the component checks if passwords match before submission.
    *   `register` action (`/auth/+page.server.ts`) validates that passwords match on the server.
    *   If validation passes, calls `supabase.auth.signUp()`.
    *   Redirects to `/auth/check-email`. (Email confirmation is likely enabled).
    *   User clicks link in email -> `auth/confirm` (PKCE flow is configured) -> user logged in.
3.  **Password Reset (PKCE Flow):**
    *   User requests reset (`/auth/+page.svelte`).
    *   `reset_password` action (`/auth/+page.server.ts`) calls `supabase.auth.resetPasswordForEmail()`, providing a `redirectTo` URL pointing to `/auth/confirm` with `next=/auth/update-password`.
    *   Redirects user to `/auth/check-email-reset`.
    *   User clicks link in email (`.../auth/confirm?token_hash=...&type=recovery&next=/auth/update-password`).
    *   `GET` handler in `/auth/confirm/+server.ts` verifies token with `verifyOtp()`. Supabase likely establishes a session upon success.
    *   `/auth/confirm` redirects to `/auth/update-password` (the `next` value).
    *   `authGuard` hook *allows* this redirect because `/auth/update-password` is in `allowedAuthRoutesWhenLoggedIn`.
    *   User sets new password on `/auth/update-password/+page.svelte`, calling `supabase.auth.updateUser()`.
4.  **OAuth Login (e.g., Google, GitHub):**
    *   User clicks provider button (`/auth/+page.svelte`).
    *   `oauth_login` action (`/auth/+page.server.ts`) calls `supabase.auth.signInWithOAuth()`, providing `/auth/callback` as `redirectTo`.
    *   Action redirects user to the OAuth provider.
    *   User authenticates with provider.
    *   Provider redirects back to `/auth/callback?code=...`.
    *   `GET` handler in `/auth/callback/+server.ts` exchanges the `code` for a session using `exchangeCodeForSession()`.
    *   Redirects to `/app` on success.

## Quick Check: Is User Logged In?

*   **Server (`.server.ts`):**
    ```typescript
    export const load = async ({ locals: { session, user } }) => {
        if (!session) {
            // Not logged in
            // redirect(303, '/auth'); // Example redirect
        } else {
            // Logged in, user object available
            console.log('User:', user);
        }
        // ...
    }
    ```
*   **Client (`.svelte`):**
    ```svelte
    <script lang="ts">
      let { data } = $props();
      let { session } = $derived(data);
    </script>

    {#if session}
      <p>User is logged in.</p>
    {:else}
      <p>User is logged out.</p>
    {/if}
    ```

## Additional Considerations & Best Practices

Here are some extra points to keep in mind when building features upon this authentication setup:

1.  **Row Level Security (RLS) is Paramount:**
    *   Since you're passing the Supabase client (potentially with an authenticated user's session) down to components, **always assume RLS is your primary database security layer**.
    *   Never rely solely on client-side checks or SvelteKit route guards (`authGuard`) to protect sensitive *data*. The `authGuard` protects *routes*, RLS protects *data access*.
    *   Ensure you have appropriate RLS policies enabled on your Supabase tables. Your server-side Supabase client (used in `load` functions and actions) will automatically use the logged-in user's JWT to interact with the database, enforcing RLS correctly. The client-side client also uses the JWT stored in cookies.

2.  **Server `load` vs. Client-Side Fetching:**
    *   **Prefer Server `load` for Initial Data:** For loading data essential for the initial page render, especially data requiring authentication, use the `load` function in `+page.server.ts` or `+layout.server.ts`. This leverages the server-side Supabase client and ensures data is available immediately on render, improving performance and security (RLS is enforced server-side).
    *   **Client-Side for Dynamic Updates:** For actions triggered by user interaction after the page loads (e.g., liking a post, adding an item to a cart), you can use the client-side `supabase` instance available via `$derived(data)` directly within your `.svelte` component's `<script>` block or event handlers. RLS will still be enforced by Supabase based on the user's cookie.

3.  **Accessing Supabase Client:**
    *   **Server (`.server.ts`):** Always use `event.locals.supabase`.
    *   **Client (`.svelte`):** Get it from the layout data: `let { supabase } = $derived(data);`.

4.  **Protecting More Routes:**
    *   To protect additional routes or directories, simply add their starting path to the `protectedPaths` array in `src/hooks.server.ts`.
    *   Remember to add an empty `+layout.ts` or `+layout.server.ts` file within any *new* directory you want fully protected by the hook to ensure it's treated as dynamic.

5.  **Error Handling:**
    *   The current setup has basic error logging in callbacks and actions. You'll want to implement more robust user-facing error handling for failed logins, signups, data fetches, etc. Use SvelteKit's `fail` action failures and potentially display messages to the user based on form action results or errors caught during client-side operations.

6.  **`safeGetSession`:** Remember this is the preferred way to check authentication *on the server* because it validates the token. Relying only on `event.locals.supabase.auth.getSession()` on the server might return a session from cookies that hasn't been validated against Supabase for that specific request.

7.  **Type Safety:** Continue using TypeScript and leverage the types inferred by SvelteKit (like `PageData`, `LayoutData`, `ActionData`) for better developer experience and fewer runtime errors.

8.  **Logout Flow:** The logout button in `src/routes/app/+layout.svelte` correctly calls `supabase.auth.signOut()`. The `onAuthStateChange` listener in the root layout will then detect the session removal and trigger `invalidate('supabase:auth')`, which updates the UI and allows the `authGuard` hook to redirect the user if they try accessing protected routes again.
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  // Always redirect back to the hardcoded Coolify deployment URL.
  // NEXT_PUBLIC_SITE_URL can override this if set as a build-time env var in Coolify.
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://hqvufimnwydrm2uufljztxsh.u0.dev').replace(/\/$/, '');

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (pairs) =>
            pairs.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            ),
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('Auth callback error:', error.message);
      return NextResponse.redirect(`${siteUrl}/?error=auth_failed`);
    }

    // User is now registered / signed in via Supabase Auth.
    // data.user contains the Google profile — no extra DB upsert needed;
    // Supabase automatically persists the user in auth.users.
    console.log('Signed in user:', data.user?.email);
  }

  return NextResponse.redirect(`${siteUrl}/`);
}

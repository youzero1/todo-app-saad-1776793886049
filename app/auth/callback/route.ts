import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  // Determine the canonical site URL in priority order:
  // 1. NEXT_PUBLIC_SITE_URL build/runtime env var (set in Coolify)
  // 2. x-forwarded-host + x-forwarded-proto headers from Traefik
  // 3. Fallback to request origin (may be localhost inside container — last resort)
  let siteUrl = '';

  if (process.env.NEXT_PUBLIC_SITE_URL) {
    siteUrl = process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  } else {
    const forwardedHost = request.headers.get('x-forwarded-host');
    const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https';
    if (forwardedHost) {
      const proto = forwardedProto.split(',')[0].trim();
      const host = forwardedHost.split(',')[0].trim();
      siteUrl = `${proto}://${host}`;
    } else {
      const reqUrl = new URL(request.url);
      siteUrl = `${reqUrl.protocol}//${reqUrl.host}`;
    }
  }

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

    const { data: sessionData, error: sessionError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (sessionError) {
      console.error('Auth callback error:', sessionError.message);
      return NextResponse.redirect(`${siteUrl}/?error=auth_failed`);
    }

    // Upsert the authenticated user into our public profiles table so we have
    // a record of every user who has signed in via Google OAuth.
    if (sessionData?.user) {
      const { user } = sessionData;
      await supabase.from('profiles').upsert(
        {
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name ?? null,
          avatar_url: user.user_metadata?.avatar_url ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
    }
  }

  // Always redirect to the public-facing site URL — never localhost.
  return NextResponse.redirect(`${siteUrl}/`);
}

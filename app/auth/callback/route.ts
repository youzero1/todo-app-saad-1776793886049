import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  // Priority 1: Explicit env var set in Coolify as build-time + runtime var.
  // Priority 2: x-forwarded-host header from Coolify's Traefik reverse proxy.
  // Priority 3: The request's own origin (last resort — may be localhost inside container).
  let siteUrl = '';

  if (process.env.NEXT_PUBLIC_SITE_URL) {
    siteUrl = process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  } else {
    const forwardedHost = request.headers.get('x-forwarded-host');
    const forwardedProto = request.headers.get('x-forwarded-proto');
    if (forwardedHost) {
      const proto = (forwardedProto ?? 'https').split(',')[0].trim();
      siteUrl = `${proto}://${forwardedHost.split(',')[0].trim()}`;
    } else {
      // Fall back to request origin — only reliable when not behind a proxy
      // that rewrites the host to localhost.
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

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('Auth callback error:', error.message);
      return NextResponse.redirect(`${siteUrl}/?error=auth_failed`);
    }
  }

  // Always redirect back to the public-facing site URL, never localhost.
  return NextResponse.redirect(`${siteUrl}/`);
}

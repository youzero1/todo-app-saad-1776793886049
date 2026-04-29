import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  // Determine the public-facing site URL using multiple strategies, in order
  // of reliability for Coolify + reverse-proxy deployments.

  // 1. Explicit build-time / runtime override — most reliable on Coolify.
  //    Set NEXT_PUBLIC_SITE_URL as a build-time AND runtime env var in Coolify.
  let siteUrl = process.env.NEXT_PUBLIC_SITE_URL
    ? process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
    : '';

  // 2. Derive from forwarded headers set by Coolify's Traefik/Nginx reverse proxy.
  if (!siteUrl) {
    const forwardedHost = request.headers.get('x-forwarded-host');
    const forwardedProto = request.headers.get('x-forwarded-proto');
    if (forwardedHost) {
      const proto = forwardedProto?.split(',')[0].trim() ?? 'https';
      siteUrl = `${proto}://${forwardedHost.split(',')[0].trim()}`;
    }
  }

  // 3. Last resort — use the incoming request's own origin.
  if (!siteUrl) {
    const reqUrl = new URL(request.url);
    siteUrl = `${reqUrl.protocol}//${reqUrl.host}`;
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

  return NextResponse.redirect(`${siteUrl}/`);
}

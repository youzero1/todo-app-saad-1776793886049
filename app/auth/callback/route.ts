import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  // Determine the site URL at runtime from the incoming request itself.
  // This works correctly on every environment (Coolify, Vercel, local)
  // without needing any hardcoded URL or build-time env var.
  // Coolify sets x-forwarded-proto and x-forwarded-host via its reverse proxy,
  // and Next.js forwards those when trustHostHeader is enabled.
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const forwardedHost = request.headers.get('x-forwarded-host');

  let siteUrl: string;
  if (forwardedHost) {
    const proto = forwardedProto?.split(',')[0].trim() ?? 'https';
    siteUrl = `${proto}://${forwardedHost.split(',')[0].trim()}`;
  } else {
    // Fallback: derive from the request URL itself (works for local dev)
    const reqUrl = new URL(request.url);
    siteUrl = `${reqUrl.protocol}//${reqUrl.host}`;
  }

  // Allow NEXT_PUBLIC_SITE_URL to explicitly override everything when set as a
  // build-time arg in Coolify (belt-and-suspenders).
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    siteUrl = process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
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

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('Auth callback error:', error.message);
      return NextResponse.redirect(`${siteUrl}/?error=auth_failed`);
    }

    console.log('Signed in user:', data.user?.email);
  }

  return NextResponse.redirect(`${siteUrl}/`);
}

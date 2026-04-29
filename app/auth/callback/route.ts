import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  // Determine the correct public base URL.
  // Priority:
  // 1. NEXT_PUBLIC_SITE_URL — set this in Coolify to your public domain
  // 2. x-forwarded-host — set by Coolify's reverse proxy
  // 3. Fall back to the host header
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https';
  const host = request.headers.get('host');

  let baseUrl: string;
  if (siteUrl) {
    baseUrl = siteUrl.replace(/\/$/, '');
  } else if (forwardedHost) {
    baseUrl = `${forwardedProto}://${forwardedHost}`;
  } else if (host) {
    // Avoid using localhost when running behind a proxy without x-forwarded-host
    baseUrl = `https://${host}`;
  } else {
    baseUrl = 'https://hqvufimnwydrm2uufljztxsh.u0.dev';
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
      return NextResponse.redirect(`${baseUrl}/?error=auth_failed`);
    }
  }

  return NextResponse.redirect(`${baseUrl}/`);
}

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  // Reconstruct the public origin using forwarded headers from the reverse proxy
  // (Coolify / nginx / Traefik). When the app runs inside Docker, request.url
  // contains the internal address (http://localhost:3000). The proxy forwards
  // the real host via x-forwarded-host so we can build the correct public URL.
  const proto = request.headers.get('x-forwarded-proto') ?? 'https';
  const host =
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    '';
  const siteUrl = host
    ? `${proto.split(',')[0].trim()}://${host.split(',')[0].trim()}`
    : new URL(request.url).origin;

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

    const { error: sessionError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (sessionError) {
      console.error('Auth callback error:', sessionError.message);
      return NextResponse.redirect(`${siteUrl}/?error=auth_failed`);
    }
  }

  return NextResponse.redirect(`${siteUrl}/`);
}

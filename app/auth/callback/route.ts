import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function publicSiteUrl(request: NextRequest) {
  const proto = request.headers.get('x-forwarded-proto') ?? 'https';
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '';
  return host
    ? `${proto.split(',')[0].trim()}://${host.split(',')[0].trim()}`
    : new URL(request.url).origin;
}

function redirectToOAuthComplete(request: NextRequest, extra?: Record<string, string>) {
  const base = new URL('/auth/oauth-complete', publicSiteUrl(request));
  for (const [k, v] of Object.entries(extra ?? {})) {
    if (v) base.searchParams.set(k, v);
  }
  return NextResponse.redirect(base.toString());
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const oauthError = searchParams.get('error');
  const oauthErrorDesc = searchParams.get('error_description');

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
    if (error) return redirectToOAuthComplete(request, { error: error.message });
    return redirectToOAuthComplete(request);
  }

  if (oauthError) {
    return redirectToOAuthComplete(request, {
      error: oauthError,
      error_description: oauthErrorDesc ?? '',
    });
  }

  return redirectToOAuthComplete(request, { error: 'missing_code' });
}

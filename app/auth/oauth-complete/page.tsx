'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const AUTH_POPUP_DONE = 'summon-supabase-auth-popup-done';

export default function AuthOAuthCompletePage() {
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error') || '';
    const errDesc = params.get('error_description') || '';
    const ok = !err;
    const payload = {
      type: AUTH_POPUP_DONE,
      ok,
      error: err || undefined,
      error_description: errDesc || undefined,
    };

    const isPopup = window.opener && !window.opener.closed;

    if (isPopup) {
      try {
        window.opener.postMessage(payload, window.location.origin);
      } catch {
        /* ignore */
      }
      try {
        window.opener.focus();
      } catch {
        /* ignore */
      }
      window.close();
      const t = window.setTimeout(() => {
        router.replace(ok ? '/' : '/');
      }, 400);
      return () => window.clearTimeout(t);
    }

    router.replace('/');
  }, [router]);

  return (
    <p className="p-8 text-center text-sm text-gray-400">Finishing sign-in\/hellip;</p>
  );
}

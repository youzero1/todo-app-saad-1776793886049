'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient, User } from '@supabase/supabase-js';

const AUTH_POPUP_NAME = 'supabase_oauth';
const AUTH_POPUP_FEATURES =
  'popup=yes,width=560,height=720,menubar=no,toolbar=no,scrollbars=yes,resizable=yes,status=no';

let _supabaseClient: SupabaseClient | null = null;
function getSupabaseClient(): SupabaseClient {
  if (_supabaseClient) return _supabaseClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing Supabase environment variables.');
  _supabaseClient = createBrowserClient(url, key);
  return _supabaseClient;
}

type Todo = {
  id: string;
  text: string;
  completed: boolean;
  created_at: string;
  user_id: string;
};

export default function Home() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [input, setInput] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    try {
      const client = getSupabaseClient();

      client.auth.getSession().then(({ data: { session } }) => {
        setUser(session?.user ?? null);
        setAuthLoading(false);
        loadTodos(client, session?.user ?? null);
      });

      const {
        data: { subscription },
      } = client.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
        setAuthLoading(false);
        loadTodos(client, session?.user ?? null);
      });

      // Listen for OAuth popup completion
      const onMsg = (e: MessageEvent) => {
        if (e.origin !== window.location.origin) return;
        if (e.data?.type === 'summon-supabase-auth-popup-done' && e.data?.ok) {
          client.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            loadTodos(client, session?.user ?? null);
          });
        }
      };
      window.addEventListener('message', onMsg);

      return () => {
        subscription.unsubscribe();
        window.removeEventListener('message', onMsg);
      };
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
      setAuthLoading(false);
    }
  }, []);

  const loadTodos = async (client: SupabaseClient, currentUser: User | null) => {
    if (!currentUser) {
      setTodos([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error } = await client
      .from('todos')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: true });
    if (error) setError('Failed to load todos: ' + error.message);
    else setTodos((data as Todo[]) || []);
    setLoading(false);
  };

  const addTodo = async () => {
    const text = input.trim();
    if (!text) return;
    if (!user) {
      setError('Please sign in to add todos.');
      return;
    }
    setError(null);
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('todos')
        .insert([{ text, completed: false, user_id: user.id }])
        .select()
        .single();
      if (error) {
        setError('Failed to add todo: ' + error.message);
      } else if (data) {
        setTodos((prev) => [...prev, data as Todo]);
        setInput('');
      }
    } catch (e) {
      setError('Failed to add todo: ' + (e as Error).message);
    }
  };

  const toggleTodo = async (id: string, completed: boolean) => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('todos')
      .update({ completed: !completed })
      .eq('id', id)
      .select()
      .single();
    if (error) setError('Failed to update todo.');
    else if (data) setTodos((prev) => prev.map((t) => (t.id === id ? (data as Todo) : t)));
  };

  const deleteTodo = async (id: string) => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('todos').delete().eq('id', id);
    if (error) setError('Failed to delete todo.');
    else setTodos((prev) => prev.filter((t) => t.id !== id));
  };

  const clearCompleted = async () => {
    const supabase = getSupabaseClient();
    const ids = todos.filter((t) => t.completed).map((t) => t.id);
    if (ids.length === 0) return;
    const { error } = await supabase.from('todos').delete().in('id', ids);
    if (error) setError('Failed to clear completed todos.');
    else setTodos((prev) => prev.filter((t) => !t.completed));
  };

  const signInWithGoogle = async () => {
    try {
      const supabase = getSupabaseClient();
      const siteUrl =
        (typeof window !== 'undefined' ? window.location.origin : '') ||
        (process.env.NEXT_PUBLIC_SITE_URL || '');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: siteUrl + '/auth/callback',
          skipBrowserRedirect: true,
        },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, AUTH_POPUP_NAME, AUTH_POPUP_FEATURES);
      }
    } catch (e) {
      setError('Failed to sign in with Google: ' + (e as Error).message);
    }
  };

  const signOut = async () => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signOut();
    if (error) setError('Failed to sign out.');
    else {
      setUser(null);
      setTodos([]);
    }
  };

  const filteredTodos = todos.filter((t) =>
    filter === 'active' ? !t.completed : filter === 'completed' ? t.completed : true
  );
  const activeCount = todos.filter((t) => !t.completed).length;

  return (
    <main className="min-h-screen px-4" style={{ background: 'transparent' }}>
      {/* Decorative sky elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10" aria-hidden>
        <div className="absolute inset-0 bg-gradient-to-b from-sky-300 via-sky-200 to-blue-100" />
        <div className="absolute top-10 right-16 w-20 h-20 rounded-full bg-yellow-200 shadow-[0_0_60px_20px_rgba(253,224,71,0.5)]" />
        <Cloud style={{ top: '6%', left: '5%', opacity: 0.9 }} scale={1.2} />
        <Cloud style={{ top: '12%', left: '30%', opacity: 0.8 }} scale={0.8} />
        <Cloud style={{ top: '4%', left: '55%', opacity: 0.85 }} scale={1.0} />
        <Cloud style={{ top: '18%', right: '8%', opacity: 0.7 }} scale={0.9} />
        <Cloud style={{ top: '28%', left: '15%', opacity: 0.6 }} scale={0.7} />
        <Cloud style={{ bottom: '30%', right: '20%', opacity: 0.5 }} scale={1.1} />
        <Cloud style={{ bottom: '15%', left: '10%', opacity: 0.4 }} scale={1.3} />
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-blue-200/60 to-transparent" />
      </div>

      {/* Top Navigation Bar */}
      <div className="w-full max-w-4xl mx-auto flex items-center justify-end py-4">
        {authLoading ? (
          <div className="h-9 w-24 bg-white/60 rounded-xl animate-pulse" />
        ) : user ? (
          <div className="flex items-center gap-3">
            {user.user_metadata?.avatar_url && (
              <img
                src={user.user_metadata.avatar_url}
                alt={user.user_metadata?.full_name ?? 'User avatar'}
                className="w-8 h-8 rounded-full border-2 border-sky-300 shadow-sm"
              />
            )}
            <span className="text-sm text-sky-900 font-medium hidden sm:block">
              {user.user_metadata?.full_name ?? user.email}
            </span>
            <button
              onClick={signOut}
              className="px-4 py-2 text-sm bg-white/80 hover:bg-white text-sky-800 font-medium rounded-xl border border-sky-200 shadow-sm transition-colors duration-150 backdrop-blur-sm"
            >
              Sign out
            </button>
          </div>
        ) : (
          <button
            onClick={signInWithGoogle}
            className="flex items-center gap-2 px-4 py-2 bg-white/80 hover:bg-white text-sky-800 font-medium rounded-xl border border-sky-200 shadow-sm transition-colors duration-150 backdrop-blur-sm"
          >
            <GoogleIcon />
            <span className="text-sm">Sign in with Google</span>
          </button>
        )}
      </div>

      {/* Main Content */}
      <div className="w-full max-w-md mx-auto pt-8">
        <h1
          className="text-4xl font-extrabold text-center mb-8 tracking-tight drop-shadow-sm"
          style={{ color: '#0c4a6e', textShadow: '0 2px 16px rgba(255,255,255,0.5)' }}
        >
          Todo List
        </h1>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50/90 border border-red-200 text-red-600 rounded-xl text-sm flex items-center justify-between backdrop-blur-sm">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-2 text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        {!user && !authLoading && (
          <div className="mb-6 px-4 py-3 bg-sky-50/80 border border-sky-200 text-sky-700 rounded-xl text-sm text-center backdrop-blur-sm">
            Sign in with Google to add and manage your todos.
          </div>
        )}

        {user && (
          <div className="flex gap-2 mb-6">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addTodo(); }}
              placeholder="What needs to be done?"
              className="flex-1 px-4 py-3 rounded-xl border border-sky-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-400 text-gray-700 bg-white/80 backdrop-blur-sm placeholder-sky-300"
            />
            <button
              onClick={addTodo}
              className="px-5 py-3 bg-sky-500 hover:bg-sky-600 text-white font-semibold rounded-xl shadow transition-colors duration-150"
            >
              Add
            </button>
          </div>
        )}

        <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-xl overflow-hidden border border-white/60">
          {loading ? (
            <div className="py-12 text-center text-sky-400 text-sm">Loading todos...</div>
          ) : !user ? (
            <div className="py-12 text-center text-sky-400 text-sm">
              Sign in to see your todos.
            </div>
          ) : filteredTodos.length === 0 ? (
            <div className="py-12 text-center text-sky-400 text-sm">
              {filter === 'completed'
                ? 'No completed tasks yet.'
                : filter === 'active'
                ? 'No active tasks! 🎉'
                : 'Add a task to get started!'}
            </div>
          ) : (
            <ul className="divide-y divide-sky-100">
              {filteredTodos.map((todo) => (
                <li
                  key={todo.id}
                  className="flex items-center gap-3 px-4 py-3 group hover:bg-sky-50/60 transition-colors"
                >
                  <button
                    onClick={() => toggleTodo(todo.id, todo.completed)}
                    className={`w-6 h-6 flex-shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
                      todo.completed
                        ? 'bg-sky-500 border-sky-500 text-white'
                        : 'border-sky-300 hover:border-sky-500'
                    }`}
                    aria-label={todo.completed ? 'Mark as incomplete' : 'Mark as complete'}
                  >
                    {todo.completed && (
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <span
                    className={`flex-1 text-sm ${
                      todo.completed ? 'line-through text-sky-300' : 'text-sky-900'
                    }`}
                  >
                    {todo.text}
                  </span>
                  <button
                    onClick={() => deleteTodo(todo.id)}
                    className="opacity-0 group-hover:opacity-100 text-sky-200 hover:text-red-500 transition-all duration-150"
                    aria-label="Delete todo"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!loading && user && todos.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 bg-sky-50/60 border-t border-sky-100 text-xs text-sky-500">
              <span>
                {activeCount} item{activeCount !== 1 ? 's' : ''} left
              </span>
              <div className="flex gap-1">
                {(['all', 'active', 'completed'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-2 py-1 rounded capitalize transition-colors ${
                      filter === f
                        ? 'bg-sky-100 text-sky-700 font-semibold'
                        : 'hover:bg-sky-100'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <button onClick={clearCompleted} className="hover:text-red-500 transition-colors">
                Clear completed
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function Cloud({ style, scale = 1 }: { style?: React.CSSProperties; scale?: number }) {
  const s = scale;
  return (
    <div className="absolute" style={style}>
      <div
        style={{
          transform: `scale(${s})`,
          transformOrigin: 'top left',
          position: 'relative',
          width: 120,
          height: 50,
        }}
      >
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 10,
            width: 100,
            height: 28,
            background: 'rgba(255,255,255,0.85)',
            borderRadius: 20,
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            left: 20,
            width: 50,
            height: 36,
            background: 'rgba(255,255,255,0.85)',
            borderRadius: '50%',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            left: 45,
            width: 40,
            height: 44,
            background: 'rgba(255,255,255,0.85)',
            borderRadius: '50%',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            left: 70,
            width: 32,
            height: 30,
            background: 'rgba(255,255,255,0.85)',
            borderRadius: '50%',
          }}
        />
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4">
      <path
        fill="#EA4335"
        d="M24 9.5c3.14 0 5.95 1.08 8.17 2.86l6.1-6.1C34.46 3.04 29.54 1 24 1 14.82 1 7.07 6.48 3.6 14.22l7.1 5.52C12.45 13.37 17.76 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.52 24.5c0-1.64-.15-3.22-.42-4.74H24v8.98h12.67c-.55 2.94-2.2 5.43-4.68 7.1l7.18 5.57C43.32 37.45 46.52 31.4 46.52 24.5z"
      />
      <path
        fill="#FBBC05"
        d="M10.7 28.26A14.6 14.6 0 0 1 9.5 24c0-1.48.25-2.92.7-4.26l-7.1-5.52A23.93 23.93 0 0 0 0 24c0 3.87.93 7.53 2.56 10.76l8.14-6.5z"
      />
      <path
        fill="#34A853"
        d="M24 47c5.54 0 10.19-1.84 13.59-4.99l-7.18-5.57c-1.84 1.24-4.2 1.97-6.41 1.97-6.24 0-11.55-3.87-13.3-9.24l-8.14 6.5C7.07 41.52 14.82 47 24 47z"
      />
      <path fill="none" d="M0 0h48v48H0z" />
    </svg>
  );
}

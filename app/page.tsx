'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient, User } from '@supabase/supabase-js';

function getSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Missing Supabase environment variables.');
  }
  return createBrowserClient(url, key);
}

type Todo = {
  id: string;
  text: string;
  completed: boolean;
  created_at: string;
};

export default function Home() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [input, setInput] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    try {
      const client = getSupabaseClient();
      setSupabase(client);

      client.auth.getSession().then(({ data: { session } }) => {
        setUser(session?.user ?? null);
        setAuthLoading(false);
      });

      const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
        setAuthLoading(false);
      });

      return () => subscription.unsubscribe();
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    if (supabase) {
      loadTodos();
    }
  }, [supabase]);

  const loadTodos = async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('todos')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) setError('Failed to load todos.');
    else setTodos(data || []);
    setLoading(false);
  };

  const addTodo = async () => {
    if (!supabase) return;
    const text = input.trim();
    if (!text) return;
    const { data, error } = await supabase
      .from('todos')
      .insert([{ text, completed: false }])
      .select()
      .single();
    if (error) setError('Failed to add todo.');
    else if (data) {
      setTodos((prev) => [...prev, data]);
      setInput('');
    }
  };

  const toggleTodo = async (id: string, completed: boolean) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('todos')
      .update({ completed: !completed })
      .eq('id', id)
      .select()
      .single();
    if (error) setError('Failed to update todo.');
    else if (data) setTodos((prev) => prev.map((t) => (t.id === id ? data : t)));
  };

  const deleteTodo = async (id: string) => {
    if (!supabase) return;
    const { error } = await supabase.from('todos').delete().eq('id', id);
    if (error) setError('Failed to delete todo.');
    else setTodos((prev) => prev.filter((t) => t.id !== id));
  };

  const clearCompleted = async () => {
    if (!supabase) return;
    const ids = todos.filter((t) => t.completed).map((t) => t.id);
    if (ids.length === 0) return;
    const { error } = await supabase.from('todos').delete().in('id', ids);
    if (error) setError('Failed to clear completed todos.');
    else setTodos((prev) => prev.filter((t) => !t.completed));
  };

  const signInWithGoogle = async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          skipBrowserRedirect: true,
        },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (e) {
      setError('Failed to sign in with Google.');
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) setError('Failed to sign out.');
    else setUser(null);
  };

  const filteredTodos = todos.filter((t) =>
    filter === 'active' ? !t.completed : filter === 'completed' ? t.completed : true
  );
  const activeCount = todos.filter((t) => !t.completed).length;

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 px-4">
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
                className="w-8 h-8 rounded-full border-2 border-indigo-300 shadow-sm"
              />
            )}
            <span className="text-sm text-gray-600 font-medium hidden sm:block">
              {user.user_metadata?.full_name ?? user.email}
            </span>
            <button
              onClick={signOut}
              className="px-4 py-2 text-sm bg-white hover:bg-gray-50 text-gray-700 font-medium rounded-xl border border-gray-200 shadow-sm transition-colors duration-150"
            >
              Sign out
            </button>
          </div>
        ) : (
          <button
            onClick={signInWithGoogle}
            className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 font-medium rounded-xl border border-gray-200 shadow-sm transition-colors duration-150"
          >
            <GoogleIcon />
            <span className="text-sm">Sign in with Google</span>
          </button>
        )}
      </div>

      {/* Main Content */}
      <div className="w-full max-w-md mx-auto pt-8">
        <h1 className="text-4xl font-extrabold text-center text-indigo-700 mb-8 tracking-tight">
          ✅ My Todo List
        </h1>
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-2 text-red-400 hover:text-red-600">✕</button>
          </div>
        )}
        <div className="flex gap-2 mb-6">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addTodo(); }}
            placeholder="What needs to be done?"
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 text-gray-700 bg-white"
          />
          <button
            onClick={addTodo}
            className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow transition-colors duration-150"
          >
            Add
          </button>
        </div>
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {loading ? (
            <div className="py-12 text-center text-gray-400 text-sm">Loading todos...</div>
          ) : filteredTodos.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">
              {filter === 'completed' ? 'No completed tasks yet.' : filter === 'active' ? 'No active tasks! 🎉' : 'Add a task to get started!'}
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filteredTodos.map((todo) => (
                <li key={todo.id} className="flex items-center gap-3 px-4 py-3 group hover:bg-gray-50 transition-colors">
                  <button
                    onClick={() => toggleTodo(todo.id, todo.completed)}
                    className={`w-6 h-6 flex-shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
                      todo.completed ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-gray-300 hover:border-indigo-400'
                    }`}
                    aria-label={todo.completed ? 'Mark as incomplete' : 'Mark as complete'}
                  >
                    {todo.completed && (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <span className={`flex-1 text-sm ${todo.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                    {todo.text}
                  </span>
                  <button
                    onClick={() => deleteTodo(todo.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all duration-150"
                    aria-label="Delete todo"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!loading && todos.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
              <span>{activeCount} item{activeCount !== 1 ? 's' : ''} left</span>
              <div className="flex gap-1">
                {(['all', 'active', 'completed'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-2 py-1 rounded capitalize transition-colors ${
                      filter === f ? 'bg-indigo-100 text-indigo-700 font-semibold' : 'hover:bg-gray-200'
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

function GoogleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4">
      <path fill="#EA4335" d="M24 9.5c3.14 0 5.95 1.08 8.17 2.86l6.1-6.1C34.46 3.04 29.54 1 24 1 14.82 1 7.07 6.48 3.6 14.22l7.1 5.52C12.45 13.37 17.76 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.52 24.5c0-1.64-.15-3.22-.42-4.74H24v8.98h12.67c-.55 2.94-2.2 5.43-4.68 7.1l7.18 5.57C43.32 37.45 46.52 31.4 46.52 24.5z"/>
      <path fill="#FBBC05" d="M10.7 28.26A14.6 14.6 0 0 1 9.5 24c0-1.48.25-2.92.7-4.26l-7.1-5.52A23.93 23.93 0 0 0 0 24c0 3.87.93 7.53 2.56 10.76l8.14-6.5z"/>
      <path fill="#34A853" d="M24 47c5.54 0 10.19-1.84 13.59-4.99l-7.18-5.57c-1.84 1.24-4.2 1.97-6.41 1.97-6.24 0-11.55-3.87-13.3-9.24l-8.14 6.5C7.07 41.52 14.82 47 24 47z"/>
      <path fill="none" d="M0 0h48v48H0z"/>
    </svg>
  );
}

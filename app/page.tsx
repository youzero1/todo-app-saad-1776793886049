'use client';

import { useState, useEffect } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

function getSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }
  return createClient(url, key);
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

  useEffect(() => {
    try {
      const client = getSupabaseClient();
      setSupabase(client);
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
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

  const filteredTodos = todos.filter((t) =>
    filter === 'active' ? !t.completed : filter === 'completed' ? t.completed : true
  );
  const activeCount = todos.filter((t) => !t.completed).length;

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 flex items-start justify-center pt-16 px-4">
      <div className="w-full max-w-md">
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

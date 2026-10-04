// Ensures Web Storage APIs exist inside the jsdom test environment.
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>()
  const storage = {
    get length() {
      return store.size
    },
    clear: () => store.clear(),
    getItem: (key: string) => (store.has(key) ? (store.get(key) as string) : null),
    key: (index: number) => [...store.keys()][index] ?? null,
    removeItem: (key: string) => void store.delete(key),
    setItem: (key: string, value: string) => void store.set(key, String(value)),
  }
  Object.defineProperty(globalThis, 'localStorage', { value: storage })
}

if (typeof import.meta.env !== 'undefined') {
  import.meta.env.VITE_SUPABASE_ANON_KEY = ''
}

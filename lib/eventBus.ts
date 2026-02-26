type Listener = (...args: any[]) => void;

const listeners = new Map<string, Set<Listener>>();

export const eventBus = {
  on(event: string, fn: Listener): () => void {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event)!.add(fn);
    return () => {
      listeners.get(event)?.delete(fn);
    };
  },

  emit(event: string, ...args: any[]) {
    listeners.get(event)?.forEach((fn) => fn(...args));
  },
};

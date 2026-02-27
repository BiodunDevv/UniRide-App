import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

// ─── Storage Keys ─────────────────────────────────────────────────────────────
const TRANSLATIONS_CACHE_KEY = "@uniride_translations_cache";
const LANGUAGE_KEY = "@uniride_selected_language";

// ─── Microsoft Translator Config ──────────────────────────────────────────────
const TRANSLATOR_API_KEY = process.env.EXPO_PUBLIC_TRANSLATOR_API_KEY;
const TRANSLATOR_REGION = process.env.EXPO_PUBLIC_TRANSLATOR_REGION;
const TRANSLATOR_ENDPOINT = process.env.EXPO_PUBLIC_TRANSLATOR_ENDPOINT;

// ─── Batch Queue (prevents 429 rate-limiting) ─────────────────────────────────
interface QueueItem {
  text: string;
  targetLang: string;
  cacheKey: string;
  resolve: (value: string) => void;
}

let batchQueue: QueueItem[] = [];
let batchTimer: ReturnType<typeof setTimeout> | null = null;
const BATCH_DELAY_MS = 80;
const MAX_BATCH_SIZE = 50;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1000;

/** Single API call for a batch of texts with exponential-backoff retry on 429 */
async function fetchBatch(
  texts: { text: string }[],
  targetLang: string,
): Promise<string[]> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(
        `${TRANSLATOR_ENDPOINT}/translate?api-version=3.0&to=${targetLang}`,
        {
          method: "POST",
          headers: {
            "Ocp-Apim-Subscription-Key": TRANSLATOR_API_KEY!,
            "Ocp-Apim-Subscription-Region": TRANSLATOR_REGION!,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(texts),
        },
      );

      if (res.status === 429 && attempt < MAX_RETRIES) {
        const wait = RETRY_BASE_MS * Math.pow(2, attempt);
        console.warn(
          `Translator 429 — retrying in ${wait}ms (attempt ${attempt + 1})`,
        );
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }

      if (!res.ok) throw new Error(`Translation API error: ${res.status}`);

      const data = await res.json();
      return data.map((d: any) => d?.translations?.[0]?.text ?? "");
    } catch (err: any) {
      if (attempt < MAX_RETRIES && String(err.message).includes("429")) {
        await new Promise((r) =>
          setTimeout(r, RETRY_BASE_MS * Math.pow(2, attempt)),
        );
        continue;
      }
      throw err;
    }
  }
  return texts.map((t) => t.text); // fallback to originals
}

/** Process a queued batch chunk */
async function processBatchChunk(items: QueueItem[], lang: string) {
  try {
    const results = await fetchBatch(
      items.map((i) => ({ text: i.text })),
      lang,
    );

    const cacheUpdates: Record<string, string> = {};
    results.forEach((translated, idx) => {
      const finalText = translated || items[idx].text;
      cacheUpdates[items[idx].cacheKey] = finalText;
      items[idx].resolve(finalText);
    });

    // Update store cache
    const store = useTranslatorStore.getState();
    const updatedCache = { ...store.translationsCache, ...cacheUpdates };
    useTranslatorStore.setState({
      translationsCache: updatedCache,
      isTranslating: false,
    });

    // Persist cache (fire-and-forget)
    AsyncStorage.setItem(
      TRANSLATIONS_CACHE_KEY,
      JSON.stringify(updatedCache),
    ).catch(() => {});

    // Clear pending keys
    useTranslatorStore.setState((state) => {
      const newPending = new Set(state.pendingTranslations);
      items.forEach((i) => newPending.delete(i.cacheKey));
      return { pendingTranslations: newPending };
    });
  } catch (error) {
    console.error("Batch translation error:", error);
    items.forEach((i) => i.resolve(i.text)); // fallback to originals
    useTranslatorStore.setState((state) => {
      const newPending = new Set(state.pendingTranslations);
      items.forEach((i) => newPending.delete(i.cacheKey));
      return { pendingTranslations: newPending, isTranslating: false };
    });
  }
}

/** Flush all queued items as batch API call(s) */
function flushQueue() {
  if (batchQueue.length === 0) return;
  const items = [...batchQueue];
  batchQueue = [];
  batchTimer = null;

  // Group by target language
  const byLang = new Map<string, QueueItem[]>();
  for (const item of items) {
    const group = byLang.get(item.targetLang) || [];
    group.push(item);
    byLang.set(item.targetLang, group);
  }

  for (const [lang, langItems] of byLang) {
    for (let i = 0; i < langItems.length; i += MAX_BATCH_SIZE) {
      processBatchChunk(langItems.slice(i, i + MAX_BATCH_SIZE), lang);
    }
  }
}

/** Add a translation request to the debounced queue */
function enqueue(item: QueueItem) {
  batchQueue.push(item);
  if (batchQueue.length >= MAX_BATCH_SIZE) {
    if (batchTimer) clearTimeout(batchTimer);
    flushQueue();
  } else {
    if (batchTimer) clearTimeout(batchTimer);
    batchTimer = setTimeout(flushQueue, BATCH_DELAY_MS);
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface LanguageOption {
  code: string;
  name: string;
  native_name: string;
  is_default?: boolean;
}

interface TranslatorState {
  /** Current language code */
  language: string;
  /** Cache: { "text|lang": "translated_text" } */
  translationsCache: Record<string, string>;
  /** Available languages from backend */
  availableLanguages: LanguageOption[];
  /** Is any translation in progress? */
  isTranslating: boolean;
  /** Has the store been initialized? */
  initialized: boolean;
  /** Error message if any */
  error: string | null;
  /** Pending translation keys to avoid duplicate API calls */
  pendingTranslations: Set<string>;

  // ─── Actions ────────────────────────────────────────────────────────────
  initialize: () => Promise<void>;
  setLanguage: (lang: string) => Promise<void>;
  setAvailableLanguages: (langs: LanguageOption[]) => void;
  getCachedTranslation: (text: string, targetLang: string) => string | null;
  translateText: (text: string, targetLang?: string | null) => Promise<string>;
  translateBatch: (
    texts: string[],
    targetLang?: string | null,
  ) => Promise<string[]>;
  clearCache: () => Promise<void>;
  getCacheSize: () => number;
}

// ─── Store ────────────────────────────────────────────────────────────────────
const useTranslatorStore = create<TranslatorState>((set, get) => ({
  language: "en",
  translationsCache: {},
  availableLanguages: [],
  isTranslating: false,
  initialized: false,
  error: null,
  pendingTranslations: new Set(),

  initialize: async () => {
    if (get().initialized) return;
    try {
      const savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);
      if (savedLanguage) set({ language: savedLanguage });

      const cachedTranslations = await AsyncStorage.getItem(
        TRANSLATIONS_CACHE_KEY,
      );
      if (cachedTranslations) {
        set({ translationsCache: JSON.parse(cachedTranslations) });
      }
      set({ initialized: true });
    } catch (error) {
      console.error("Error initializing translator:", error);
      set({ initialized: true });
    }
  },

  setLanguage: async (lang: string) => {
    try {
      await AsyncStorage.setItem(LANGUAGE_KEY, lang);
      set({ language: lang, error: null });
    } catch (error) {
      console.error("Error setting language:", error);
      set({ error: "Failed to set language" });
    }
  },

  setAvailableLanguages: (langs: LanguageOption[]) => {
    set({ availableLanguages: langs });
  },

  getCachedTranslation: (text: string, targetLang: string) => {
    const cacheKey = `${text}|${targetLang}`;
    return get().translationsCache[cacheKey] || null;
  },

  translateText: async (
    text: string,
    targetLang: string | null = null,
  ): Promise<string> => {
    if (!text || text.trim() === "") return "";

    const toLang = targetLang || get().language;
    if (toLang === "en") return text;

    // Check cache first
    const cached = get().getCachedTranslation(text, toLang);
    if (cached) return cached;

    // Check if already pending — wait for it
    const cacheKey = `${text}|${toLang}`;
    if (get().pendingTranslations.has(cacheKey)) {
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          const c = get().getCachedTranslation(text, toLang);
          if (c) {
            clearInterval(checkInterval);
            resolve(c);
          }
        }, 100);
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve(text);
        }, 10000);
      });
    }

    // Mark as pending & add to the debounced batch queue
    set((state) => ({
      pendingTranslations: new Set(state.pendingTranslations).add(cacheKey),
      isTranslating: true,
    }));

    return new Promise<string>((resolve) => {
      enqueue({ text, targetLang: toLang, cacheKey, resolve });
    });
  },

  translateBatch: async (
    texts: string[],
    targetLang: string | null = null,
  ): Promise<string[]> => {
    const toLang = targetLang || get().language;
    if (toLang === "en") return texts;
    return Promise.all(texts.map((t) => get().translateText(t, toLang)));
  },

  clearCache: async () => {
    try {
      await AsyncStorage.removeItem(TRANSLATIONS_CACHE_KEY);
      set({ translationsCache: {}, error: null });
    } catch (error) {
      console.error("Error clearing translation cache:", error);
      set({ error: "Failed to clear cache" });
    }
  },

  getCacheSize: () => Object.keys(get().translationsCache).length,
}));

export default useTranslatorStore;

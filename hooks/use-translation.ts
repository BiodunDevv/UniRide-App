import { useEffect, useState } from "react";
import useTranslatorStore from "@/store/useTranslatorStore";

/**
 * Translate a single string reactively.
 * Returns the cached translation instantly; fetches from API in background if missing.
 *
 * @example
 * const title = useTranslation("Welcome to UniRide");
 * <Text>{title}</Text>
 */
export const useTranslation = (
  text: string,
  targetLang: string | null = null,
): string => {
  const { language, translateText, getCachedTranslation } =
    useTranslatorStore();
  const [translated, setTranslated] = useState(text);

  useEffect(() => {
    if (!text || text.trim() === "") {
      setTranslated("");
      return;
    }

    const lang = targetLang || language;
    if (lang === "en") {
      setTranslated(text);
      return;
    }

    // Show cached version instantly
    const cached = getCachedTranslation(text, lang);
    if (cached) {
      setTranslated(cached);
      return;
    }

    // Show original while fetching
    setTranslated(text);

    // Fetch translation in background
    translateText(text, lang).then(setTranslated);
  }, [text, language, targetLang]);

  return translated;
};

/**
 * Translate multiple strings at once.
 *
 * @example
 * const [title, sub] = useTranslations(["Welcome", "Get Started"]);
 */
export const useTranslations = (
  texts: string[],
  targetLang: string | null = null,
): string[] => {
  const { language, translateBatch } = useTranslatorStore();
  const [translated, setTranslated] = useState(texts);

  useEffect(() => {
    const lang = targetLang || language;

    if (lang === "en") {
      setTranslated(texts);
      return;
    }

    translateBatch(texts, lang).then(setTranslated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texts.join("|"), language, targetLang]);

  return translated;
};

/**
 * Synchronous cache-only translation — for non-React contexts.
 */
export const translateSync = (text: string, targetLang: string): string => {
  const cached = useTranslatorStore
    .getState()
    .getCachedTranslation(text, targetLang);
  return cached || text;
};

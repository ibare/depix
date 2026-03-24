import type { Lang } from './types';

export function detectLanguage(): Lang {
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'en';
  return nav.startsWith('ko') ? 'ko' : 'en';
}

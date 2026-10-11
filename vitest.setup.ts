import '@testing-library/jest-dom/vitest';
import { type ReactNode } from 'react';

// Environment variables (.env.test) are loaded by Vitest (mode "test").

// mock i18next - all text in tests will be returned as the translation key
// e.g. <h1>{t('page.title')}</h1> -> <h1>page.title</h1>
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    use: () => ({ init: vi.fn() }),
  }),
  I18nextProvider: ({ children }: { children: ReactNode }) => children,
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('i18next', () => {
  const i18n = {
    t: (key: string) => key,
    use: () => ({ init: vi.fn() }),
  };
  return { ...i18n, default: i18n };
});

// jsdom has no scrolling; the router's scroll restoration calls it on navigation.
vi.stubGlobal('scrollTo', vi.fn());

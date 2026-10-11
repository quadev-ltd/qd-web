import { render, screen } from '@testing-library/react';

import { App } from './App';

import { SessionStatus } from '@/core/state/slices/sessionSlice';
import { type AppStore, createStore } from '@/core/state/store';

// The configuration comes from .env.test (account flag off, unavailable auth gateway).

vi.mock('@/core/state/store', async importOriginal => {
  const actual = await importOriginal<{ createStore: () => AppStore }>();
  return { ...actual, createStore: vi.fn(actual.createStore) };
});

describe('App', () => {
  it('renders the screen for the current URL', () => {
    render(<App />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'publicHome.title' }),
    ).toBeInTheDocument();
  });

  it('starts the session: signed out, with the unavailable auth gateway', () => {
    render(<App />);

    const store: AppStore = vi.mocked(createStore).mock.results.at(-1)?.value;
    expect(store.getState().session.status).toBe(SessionStatus.SignedOut);
  });
});

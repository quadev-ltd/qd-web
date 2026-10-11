import { render } from '@testing-library/react';
import { type ReactElement } from 'react';
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router';

import { routes } from '@/app/routes';

interface Options {
  /** The URL the component is rendered at. */
  route?: string;
}

// Translations are mocked in vitest.setup.ts (t returns the key), so no i18n
// provider is needed here. Later providers (store, session, flags) are added in
// this one place.

/** Renders a component or a screen inside a router. */
export const renderWithProviders = (
  ui: ReactElement,
  { route = '/' }: Options = {},
) => render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>);

/** Renders the application's routes at a URL, to test which screen a path shows. */
export const renderRoute = (route: string) =>
  render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: [route] })}
    />,
  );

export default renderWithProviders;

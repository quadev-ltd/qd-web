import { render, renderHook, screen } from '@testing-library/react';
import { type ReactNode } from 'react';

import { AuthGatewayProvider, useAuthGateway } from './AuthGatewayProvider';
import { type AuthGateway } from './gateway';
import { selectAuthGateway } from './selectAuthGateway';
import { unavailableGateway } from './unavailableGateway';

import { createMockGateway } from '@/testUtil/mockGateway';

vi.mock('./selectAuthGateway', () => ({ selectAuthGateway: vi.fn() }));

const mockSelect = vi.mocked(selectAuthGateway);

const Child = () => {
  const gateway = useAuthGateway();
  return <p>{gateway === unavailableGateway ? 'unavailable' : 'other'}</p>;
};

describe('AuthGatewayProvider', () => {
  beforeEach(() => {
    mockSelect.mockReset();
    mockSelect.mockReturnValue(unavailableGateway);
  });

  it('is the unavailable gateway without a provider', () => {
    const { result } = renderHook(() => useAuthGateway());

    expect(result.current).toBe(unavailableGateway);
  });

  it('provides the gateway chosen by the configuration, at once', () => {
    const { result } = renderHook(() => useAuthGateway(), {
      wrapper: AuthGatewayProvider,
    });

    expect(result.current).toBe(unavailableGateway);
    expect(mockSelect).toHaveBeenCalledTimes(1);
  });

  it('provides the gateway it is given, without choosing one', () => {
    const gateway = createMockGateway();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <AuthGatewayProvider gateway={gateway}>{children}</AuthGatewayProvider>
    );

    const { result } = renderHook(() => useAuthGateway(), { wrapper });

    expect(result.current).toBe(gateway);
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it('renders nothing until a gateway that loads on demand has arrived', async () => {
    let arrive: (value: AuthGateway) => void = () => undefined;
    mockSelect.mockReturnValue(
      new Promise<AuthGateway>(resolve => {
        arrive = resolve;
      }),
    );

    render(
      <AuthGatewayProvider>
        <Child />
      </AuthGatewayProvider>,
    );
    expect(screen.queryByText('other')).not.toBeInTheDocument();
    expect(screen.queryByText('unavailable')).not.toBeInTheDocument();

    arrive(createMockGateway());

    expect(await screen.findByText('other')).toBeInTheDocument();
  });
});

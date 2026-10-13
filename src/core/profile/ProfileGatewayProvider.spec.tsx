import { render, screen } from '@testing-library/react';

import { ProfileErrorCode } from './errors';
import { type ProfileGateway } from './gateway';
import {
  ProfileGatewayProvider,
  useProfileGateway,
} from './ProfileGatewayProvider';
import { selectProfileGateway } from './selectProfileGateway';
import { unavailableProfileGateway } from './unavailableProfileGateway';

import { createMockProfileGateway } from '@/testUtil/mockProfileGateway';

vi.mock('./selectProfileGateway', () => ({
  selectProfileGateway: vi.fn(),
}));

const Probe = () => {
  const gateway = useProfileGateway();
  return (
    <p>{gateway === unavailableProfileGateway ? 'unavailable' : 'a gateway'}</p>
  );
};

beforeEach(() => {
  vi.mocked(selectProfileGateway).mockReset();
  vi.mocked(selectProfileGateway).mockReturnValue(unavailableProfileGateway);
});

describe('ProfileGatewayProvider', () => {
  it('gives the unavailable gateway without a provider', async () => {
    render(<Probe />);

    expect(screen.getByText('unavailable')).toBeInTheDocument();
    await expect(
      unavailableProfileGateway.getResources('uid-1'),
    ).rejects.toMatchObject({ code: ProfileErrorCode.Unavailable });
  });

  it('gives the gateway it is handed, and chooses none', () => {
    render(
      <ProfileGatewayProvider gateway={createMockProfileGateway()}>
        <Probe />
      </ProfileGatewayProvider>,
    );

    expect(screen.getByText('a gateway')).toBeInTheDocument();
    expect(selectProfileGateway).not.toHaveBeenCalled();
  });

  it('gives the chosen gateway at once when it is already there', () => {
    render(
      <ProfileGatewayProvider>
        <Probe />
      </ProfileGatewayProvider>,
    );

    expect(screen.getByText('unavailable')).toBeInTheDocument();
    expect(selectProfileGateway).toHaveBeenCalledTimes(1);
  });

  it('shows the fallback until a gateway that is loaded on demand arrives', async () => {
    let arrive: (gateway: ProfileGateway) => void = () => undefined;
    vi.mocked(selectProfileGateway).mockReturnValue(
      new Promise<ProfileGateway>(resolve => {
        arrive = resolve;
      }),
    );

    render(
      <ProfileGatewayProvider fallback={<p>loading the profile</p>}>
        <Probe />
      </ProfileGatewayProvider>,
    );

    expect(screen.getByText('loading the profile')).toBeInTheDocument();
    expect(screen.queryByText('a gateway')).not.toBeInTheDocument();

    arrive(createMockProfileGateway());

    expect(await screen.findByText('a gateway')).toBeInTheDocument();
    expect(screen.queryByText('loading the profile')).not.toBeInTheDocument();
  });

  it('shows nothing while loading when no fallback is given', () => {
    vi.mocked(selectProfileGateway).mockReturnValue(new Promise(() => {}));

    const { container } = render(
      <ProfileGatewayProvider>
        <Probe />
      </ProfileGatewayProvider>,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('chooses the gateway once, also when it renders again', () => {
    const { rerender } = render(
      <ProfileGatewayProvider>
        <Probe />
      </ProfileGatewayProvider>,
    );
    rerender(
      <ProfileGatewayProvider>
        <Probe />
      </ProfileGatewayProvider>,
    );

    expect(selectProfileGateway).toHaveBeenCalledTimes(1);
  });
});

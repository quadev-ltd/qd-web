import * as profileModule from './interviewProfile';
import { createFirebaseProfileGateway } from './profileGateway';

import { unavailableProfileGateway } from '@/core/profile/unavailableProfileGateway';

vi.mock('./interviewProfile', () => ({
  createResource: vi.fn(),
  getExtractionsToday: vi.fn(),
  getFileUrl: vi.fn(),
  getItems: vi.fn(),
  getResource: vi.fn(),
  getResources: vi.fn(),
  getResourceText: vi.fn(),
  readLinkAgain: vi.fn(),
  removeItem: vi.fn(),
  removeResource: vi.fn(),
  updateItem: vi.fn(),
  uploadFile: vi.fn(),
}));

describe('the Firebase profile gateway', () => {
  const gateway = createFirebaseProfileGateway();

  it('has every function of the profile gateway', () => {
    expect(Object.keys(gateway).sort()).toEqual(
      Object.keys(unavailableProfileGateway).sort(),
    );
  });

  it('is made of the module functions of this folder', () => {
    expect(gateway.getResources).toBe(profileModule.getResources);
    expect(gateway.getResource).toBe(profileModule.getResource);
    expect(gateway.getItems).toBe(profileModule.getItems);
    expect(gateway.getExtractionsToday).toBe(profileModule.getExtractionsToday);
    expect(gateway.createResource).toBe(profileModule.createResource);
    expect(gateway.uploadFile).toBe(profileModule.uploadFile);
    expect(gateway.updateItem).toBe(profileModule.updateItem);
    expect(gateway.removeItem).toBe(profileModule.removeItem);
    expect(gateway.removeResource).toBe(profileModule.removeResource);
    expect(gateway.getFileUrl).toBe(profileModule.getFileUrl);
    expect(gateway.getResourceText).toBe(profileModule.getResourceText);
    expect(gateway.readLinkAgain).toBe(profileModule.readLinkAgain);
  });
});

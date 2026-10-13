import { ProfileError, ProfileErrorCode } from './errors';
import { unavailableProfileGateway as gateway } from './unavailableProfileGateway';

describe('unavailableProfileGateway', () => {
  it.each([
    ['getResources', () => gateway.getResources('uid-1')],
    ['getResource', () => gateway.getResource('uid-1', 'r1')],
    ['getItems', () => gateway.getItems('uid-1')],
    ['getExtractionsToday', () => gateway.getExtractionsToday('uid-1')],
    [
      'createResource',
      () =>
        gateway.createResource({
          source: 'text',
          type: 'note',
          title: 'Notes',
          text: 'Go',
        }),
    ],
    [
      'uploadFile',
      () =>
        gateway.uploadFile(
          { path: 'p', contentType: 'text/plain', maxBytes: 1 },
          new Blob(['x']),
        ),
    ],
    ['updateItem', () => gateway.updateItem('i1', { starred: true })],
    ['removeItem', () => gateway.removeItem('i1')],
    ['removeResource', () => gateway.removeResource('r1')],
    ['getFileUrl', () => gateway.getFileUrl({ storagePath: 'p' })],
  ])('rejects %s with "unavailable"', async (_name, action) => {
    const error = await action().then(
      () => undefined,
      (reason: unknown) => reason,
    );

    expect(error).toBeInstanceOf(ProfileError);
    expect((error as ProfileError).code).toBe(ProfileErrorCode.Unavailable);
  });
});

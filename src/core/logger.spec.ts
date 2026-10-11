describe('logger', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws when it is used before being set up', async () => {
    const { default: logger } = await import('./logger');

    expect(() => logger()).toThrow('Logger not initialized');
  });

  it('writes errors and messages to the console outside production', async () => {
    const { default: logger, setUpLogger } = await import('./logger');
    const error = new Error('boom');

    setUpLogger('dev');
    logger().logError(error);
    logger().logMessage('hello');

    expect(console.error).toHaveBeenCalledWith(error);
    expect(console.info).toHaveBeenCalledWith('hello');
  });

  it('keeps errors and drops messages in production', async () => {
    const { default: logger, setUpLogger } = await import('./logger');
    const error = new Error('boom');

    setUpLogger('prod');
    logger().logError(error);
    logger().logMessage('hello');

    expect(console.error).toHaveBeenCalledWith(error);
    expect(console.info).not.toHaveBeenCalled();
  });
});

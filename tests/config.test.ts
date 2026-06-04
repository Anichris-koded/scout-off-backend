process.env.CONTRACT_ID = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4';
process.env.JWT_SECRET = 'test-secret';

describe('config NODE_ENV toggles', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.resetModules();
  });

  async function loadConfig(env: string) {
    process.env.NODE_ENV = env;
    jest.resetModules();
    const mod = await import('../src/config');
    return mod.default;
  }

  async function loadHelpers(env: string) {
    process.env.NODE_ENV = env;
    jest.resetModules();
    return import('../src/config');
  }

  it('development: debug log, showErrorDetails=true, useMockServices=true', async () => {
    const cfg = await loadConfig('development');
    expect(cfg.logLevel).toBe('debug');
    expect(cfg.showErrorDetails).toBe(true);
    expect(cfg.useMockServices).toBe(true);
  });

  it('test: warn log, showErrorDetails=true, useMockServices=true', async () => {
    const cfg = await loadConfig('test');
    expect(cfg.logLevel).toBe('warn');
    expect(cfg.showErrorDetails).toBe(true);
    expect(cfg.useMockServices).toBe(true);
  });

  it('staging: info log, showErrorDetails=false, useMockServices=false', async () => {
    const cfg = await loadConfig('staging');
    expect(cfg.logLevel).toBe('info');
    expect(cfg.showErrorDetails).toBe(false);
    expect(cfg.useMockServices).toBe(false);
  });

  it('production: warn log, showErrorDetails=false, useMockServices=false', async () => {
    const cfg = await loadConfig('production');
    expect(cfg.logLevel).toBe('warn');
    expect(cfg.showErrorDetails).toBe(false);
    expect(cfg.useMockServices).toBe(false);
  });

  it('staging and production settings are distinct from development', async () => {
    const dev = await loadConfig('development');
    const prod = await loadConfig('production');
    expect(dev.showErrorDetails).not.toBe(prod.showErrorDetails);
    expect(dev.useMockServices).not.toBe(prod.useMockServices);
  });

  it('isProduction() returns true for production', async () => {
    const { isProduction } = await loadHelpers('production');
    expect(isProduction()).toBe(true);
  });

  it('isStaging() returns true for staging', async () => {
    const { isStaging } = await loadHelpers('staging');
    expect(isStaging()).toBe(true);
  });

  it('isDevelopment() returns true for development', async () => {
    const { isDevelopment } = await loadHelpers('development');
    expect(isDevelopment()).toBe(true);
  });

  it('throws on invalid NODE_ENV', async () => {
    process.env.NODE_ENV = 'invalid_env';
    jest.resetModules();
    await expect(import('../src/config')).rejects.toThrow('Invalid NODE_ENV');
  });
});

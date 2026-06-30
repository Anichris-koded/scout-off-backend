process.env.CONTRACT_ID = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4';
process.env.JWT_SECRET = 'test-secret';

describe('config NODE_ENV toggles', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalAdminWallet = process.env.ADMIN_WALLET;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    if (originalAdminWallet !== undefined) {
      process.env.ADMIN_WALLET = originalAdminWallet;
    } else {
      delete process.env.ADMIN_WALLET;
    }
    jest.resetModules();
  });

  async function loadConfig(env: string) {
    process.env.NODE_ENV = env;
    // Ensure ADMIN_WALLET is set when loading production/staging config
    if (env === 'production' || env === 'staging') {
      process.env.ADMIN_WALLET = 'GADMINWALLET1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    }
    jest.resetModules();
    const mod = await import('../src/config');
    return mod.default;
  }

  async function loadHelpers(env: string) {
    process.env.NODE_ENV = env;
    if (env === 'production' || env === 'staging') {
      process.env.ADMIN_WALLET = 'GADMINWALLET1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    }
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

// ─── ADMIN_WALLET validation ──────────────────────────────────────────────────

describe('config ADMIN_WALLET validation', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalAdminWallet = process.env.ADMIN_WALLET;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    if (originalAdminWallet !== undefined) {
      process.env.ADMIN_WALLET = originalAdminWallet;
    } else {
      delete process.env.ADMIN_WALLET;
    }
    jest.resetModules();
  });

  it('throws in production when ADMIN_WALLET is not set', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ADMIN_WALLET;
    jest.resetModules();
    await expect(import('../src/config')).rejects.toThrow('ADMIN_WALLET is required in production');
  });

  it('error message names the missing env var', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ADMIN_WALLET;
    jest.resetModules();
    await expect(import('../src/config')).rejects.toThrow('ADMIN_WALLET');
  });

  it('throws in production when ADMIN_WALLET is an empty string', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ADMIN_WALLET = '';
    jest.resetModules();
    await expect(import('../src/config')).rejects.toThrow('ADMIN_WALLET is required in production');
  });

  it('does not throw in production when ADMIN_WALLET is set', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ADMIN_WALLET = 'GADMINWALLET1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    jest.resetModules();
    await expect(import('../src/config')).resolves.toBeTruthy();
  });

  it('logs a warning in staging when ADMIN_WALLET is not set', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.NODE_ENV = 'staging';
    delete process.env.ADMIN_WALLET;
    jest.resetModules();
    await import('../src/config');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('ADMIN_WALLET'),
    );
    warnSpy.mockRestore();
  });

  it('does not warn in staging when ADMIN_WALLET is set', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.NODE_ENV = 'staging';
    process.env.ADMIN_WALLET = 'GADMINWALLET1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    jest.resetModules();
    await import('../src/config');
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('does not throw in development when ADMIN_WALLET is not set', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.ADMIN_WALLET;
    jest.resetModules();
    await expect(import('../src/config')).resolves.toBeTruthy();
  });

  it('does not throw in test when ADMIN_WALLET is not set', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.ADMIN_WALLET;
    jest.resetModules();
    await expect(import('../src/config')).resolves.toBeTruthy();
  });
});

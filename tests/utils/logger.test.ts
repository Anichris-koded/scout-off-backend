import config from '../../src/config';
import { logger } from '../../src/utils/logger';

describe('logger', () => {
  afterEach(() => {
    (config as any).logLevel = 'info';
  });

  it('suppresses debug output when LOG_LEVEL is info', () => {
    (config as any).logLevel = 'info';
    const spy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    logger.debug('should not appear');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('emits debug output when LOG_LEVEL is debug', () => {
    (config as any).logLevel = 'debug';
    const spy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    logger.debug('should appear');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('emits warn output at warn level', () => {
    (config as any).logLevel = 'warn';
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    logger.warn('warning');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('suppresses info output when LOG_LEVEL is warn', () => {
    (config as any).logLevel = 'warn';
    const spy = jest.spyOn(console, 'info').mockImplementation(() => {});
    logger.info('should not appear');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

import config from '../../src/config';
import { logger } from '../../src/utils/logger';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
const cfg = config as { logLevel: LogLevel };

describe('logger', () => {
  afterEach(() => {
    cfg.logLevel = 'info';
  });

  it('suppresses debug output when LOG_LEVEL is info', () => {
    cfg.logLevel = 'info';
    const spy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    logger.debug('should not appear');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('emits debug output when LOG_LEVEL is debug', () => {
    cfg.logLevel = 'debug';
    const spy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    logger.debug('should appear');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('emits warn output at warn level', () => {
    cfg.logLevel = 'warn';
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    logger.warn('warning');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('suppresses info output when LOG_LEVEL is warn', () => {
    cfg.logLevel = 'warn';
    const spy = jest.spyOn(console, 'info').mockImplementation(() => {});
    logger.info('should not appear');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

import { startVisiblePolling } from '../visiblePolling';

describe('visible polling', () => {
  let visibility: jest.SpyInstance;
  beforeEach(() => {
    jest.useFakeTimers();
    visibility = jest.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  });
  afterEach(() => { visibility.mockRestore(); jest.useRealTimers(); });
  it('pauses hidden tabs, resumes immediately and stops after cleanup', async () => {
    const refresh = jest.fn(async () => {});
    const stop = startVisiblePolling(refresh, 20000);
    visibility.mockReturnValue('hidden');
    jest.advanceTimersByTime(60000);
    expect(refresh).not.toHaveBeenCalled();
    visibility.mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    await Promise.resolve();
    expect(refresh).toHaveBeenCalledTimes(1);
    stop(); jest.advanceTimersByTime(60000);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(refresh).toHaveBeenCalledTimes(1);
  });
  it('does not overlap a slow poll with intervals or visibility events', async () => {
    let resolve!: () => void;
    const refresh = jest.fn(() => new Promise<void>(done => { resolve = done; }));
    const stop = startVisiblePolling(refresh, 12000);
    jest.advanceTimersByTime(12000);
    jest.advanceTimersByTime(60000);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(refresh).toHaveBeenCalledTimes(1);
    resolve(); await Promise.resolve();
    jest.advanceTimersByTime(12000);
    expect(refresh).toHaveBeenCalledTimes(2);
    resolve(); await Promise.resolve(); stop();
  });
});

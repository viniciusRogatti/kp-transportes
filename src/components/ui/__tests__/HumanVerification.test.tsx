import React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import HumanVerification from '../HumanVerification';

jest.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ isLightTheme: false }),
}));

type WidgetOptions = {
  size: 'normal' | 'compact';
  theme: 'light' | 'dark';
  callback: (token: string) => void;
  'expired-callback': () => void;
  'error-callback': () => void;
};

const originalResizeObserver = window.ResizeObserver;
const originalTurnstileKey = process.env.REACT_APP_TURNSTILE_SITE_KEY;
const originalRecaptchaKey = process.env.REACT_APP_RECAPTCHA_SITE_KEY;
const observers: ResizeObserverMock[] = [];

class ResizeObserverMock {
  disconnect = jest.fn();
  observe = jest.fn();

  constructor(private callback: ResizeObserverCallback) {
    observers.push(this);
  }

  resize(width: number) {
    this.callback([{ contentRect: { width } } as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
}

const turnstileRender = jest.fn<string, [HTMLElement, Record<string, unknown>]>();
const recaptchaRender = jest.fn<number, [HTMLElement, Record<string, unknown>]>();
const turnstileRemove = jest.fn();
const turnstileReset = jest.fn();
const recaptchaReset = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  observers.length = 0;
  window.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
  jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(305);
  process.env.REACT_APP_TURNSTILE_SITE_KEY = 'turnstile-test';
  process.env.REACT_APP_RECAPTCHA_SITE_KEY = 'recaptcha-test';
  turnstileRender.mockImplementation(() => `widget-${turnstileRender.mock.calls.length}`);
  recaptchaRender.mockImplementation(() => recaptchaRender.mock.calls.length);
  window.turnstile = { render: turnstileRender, remove: turnstileRemove, reset: turnstileReset };
  window.grecaptcha = { render: recaptchaRender, reset: recaptchaReset, ready: (callback) => callback() };
  const script = document.createElement('script');
  script.id = 'recaptcha-script';
  script.dataset.loaded = 'true';
  document.head.appendChild(script);
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  document.getElementById('recaptcha-script')?.remove();
  delete window.turnstile;
  delete window.grecaptcha;
  window.ResizeObserver = originalResizeObserver;
});

afterAll(() => {
  if (originalTurnstileKey === undefined) delete process.env.REACT_APP_TURNSTILE_SITE_KEY;
  else process.env.REACT_APP_TURNSTILE_SITE_KEY = originalTurnstileKey;
  if (originalRecaptchaKey === undefined) delete process.env.REACT_APP_RECAPTCHA_SITE_KEY;
  else process.env.REACT_APP_RECAPTCHA_SITE_KEY = originalRecaptchaKey;
});

describe.each(['turnstile', 'recaptcha'] as const)('HumanVerification com %s', (provider) => {
  const getRender = () => provider === 'turnstile' ? turnstileRender : recaptchaRender;
  const getOptions = (index: number) => getRender().mock.calls[index][1] as WidgetOptions;

  it('usa tema explícito e recria o widget apenas ao mudar de faixa de largura', async () => {
    const onTokenChange = jest.fn();
    const { unmount } = render(<HumanVerification provider={provider} theme="light" onTokenChange={onTokenChange} />);
    await waitFor(() => expect(getRender()).toHaveBeenCalledTimes(1));
    expect(getOptions(0)).toMatchObject({ size: 'normal', theme: 'light' });

    act(() => getOptions(0).callback('token-normal'));
    expect(onTokenChange).toHaveBeenLastCalledWith('token-normal');
    act(() => observers[0].resize(310));
    expect(getRender()).toHaveBeenCalledTimes(1);

    act(() => observers[0].resize(260));
    await waitFor(() => expect(getRender()).toHaveBeenCalledTimes(2));
    expect(getOptions(1)).toMatchObject({ size: 'compact', theme: 'light' });
    expect(onTokenChange).toHaveBeenLastCalledWith('');
    if (provider === 'turnstile') expect(turnstileRemove).toHaveBeenCalledWith('widget-1');
    else {
      expect(recaptchaReset).toHaveBeenCalledWith(1);
      expect(recaptchaRender.mock.calls[0][0]).not.toBe(recaptchaRender.mock.calls[1][0]);
    }

    onTokenChange.mockClear();
    act(() => getOptions(0).callback('token-obsoleto'));
    expect(onTokenChange).not.toHaveBeenCalled();
    act(() => getOptions(1).callback('token-compacto'));
    expect(onTokenChange).toHaveBeenLastCalledWith('token-compacto');

    act(() => observers[0].resize(305));
    await waitFor(() => expect(getRender()).toHaveBeenCalledTimes(3));
    expect(getOptions(2).size).toBe('normal');
    expect(onTokenChange).toHaveBeenLastCalledWith('');

    unmount();
    expect(observers[0].disconnect).toHaveBeenCalledTimes(1);
    onTokenChange.mockClear();
    act(() => getOptions(2).callback('token-apos-desmontar'));
    expect(onTokenChange).not.toHaveBeenCalled();
  });

  it('inicia compacto em 260px e mantém o tema do aplicativo quando não há override', async () => {
    jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(260);
    const onTokenChange = jest.fn();
    const { rerender } = render(<HumanVerification provider={provider} onTokenChange={onTokenChange} />);
    await waitFor(() => expect(getRender()).toHaveBeenCalledTimes(1));
    expect(getOptions(0)).toMatchObject({ size: 'compact', theme: 'dark' });

    const updatedOnTokenChange = jest.fn();
    rerender(<HumanVerification provider={provider} onTokenChange={updatedOnTokenChange} />);
    expect(getRender()).toHaveBeenCalledTimes(1);
    act(() => getOptions(0).callback('token-atual'));
    expect(updatedOnTokenChange).toHaveBeenLastCalledWith('token-atual');

    rerender(<HumanVerification provider={provider} theme="light" onTokenChange={updatedOnTokenChange} />);
    await waitFor(() => expect(getRender()).toHaveBeenCalledTimes(2));
    expect(getOptions(1)).toMatchObject({ size: 'compact', theme: 'light' });
    expect(updatedOnTokenChange).toHaveBeenLastCalledWith('');
  });

  it('invalida o token e reseta a instância ativa quando a verificação expira', async () => {
    const onTokenChange = jest.fn();
    render(<HumanVerification provider={provider} onTokenChange={onTokenChange} />);
    await waitFor(() => expect(getRender()).toHaveBeenCalledTimes(1));
    act(() => getOptions(0).callback('token-valido'));
    act(() => getOptions(0)['expired-callback']());
    expect(onTokenChange).toHaveBeenLastCalledWith('');
    if (provider === 'turnstile') expect(turnstileReset).toHaveBeenCalledWith('widget-1');
    else expect(recaptchaReset).toHaveBeenCalledWith(1);
  });
});

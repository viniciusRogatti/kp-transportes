import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { Container, LoginCard } from '..';

const originalResizeObserver = window.ResizeObserver;
const originalVisualViewport = window.visualViewport;
let resizeCallback: ResizeObserverCallback;
let naturalHeight = 1000;

class ResizeObserverMock {
  observe = jest.fn();
  disconnect = jest.fn();

  constructor(callback: ResizeObserverCallback) {
    resizeCallback = callback;
  }
}

beforeEach(() => {
  jest.useFakeTimers();
  naturalHeight = 1000;
  window.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => window.setTimeout(() => callback(0), 16));
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => window.clearTimeout(id));
  jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('login-card-viewport') ? 360 : 0;
  });
  jest.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('login-card-viewport') ? 780 : 0;
  });
  jest.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('login-stage') ? 358 : 0;
  });
  jest.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('login-stage') ? naturalHeight : 0;
  });
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  jest.useRealTimers();
  window.ResizeObserver = originalResizeObserver;
  Object.defineProperty(window, 'visualViewport', { configurable: true, writable: true, value: originalVisualViewport });
});

it('reajusta o cartão quando mensagens aumentam sua altura e devolve a escala original quando cabem', () => {
  const { container } = render(<LoginCard><button type="button">Entrar no sistema</button><details><summary>Ajuda</summary>Texto de ajuda.</details></LoginCard>);
  const fit = container.querySelector('.login-card-fit') as HTMLDivElement;
  expect(Number(fit.style.getPropertyValue('--login-fit-scale'))).toBeCloseTo(0.778);

  naturalHeight = 1400;
  act(() => {
    resizeCallback([], {} as ResizeObserver);
    jest.advanceTimersByTime(16);
  });
  expect(Number(fit.style.getPropertyValue('--login-fit-scale'))).toBeLessThan(0.56);
  expect(screen.getByRole('button', { name: 'Entrar no sistema' })).toBeInTheDocument();
  expect(screen.getByText('Ajuda')).toBeInTheDocument();

  naturalHeight = 600;
  act(() => {
    resizeCallback([], {} as ResizeObserver);
    jest.advanceTimersByTime(16);
  });
  expect(fit.style.getPropertyValue('--login-fit-scale')).toBe('1');
});

it('acompanha a área visível do teclado e libera a rolagem do aplicativo ao sair do login', () => {
  const viewport = Object.assign(new EventTarget(), { width: 390, height: 844, offsetTop: 0, offsetLeft: 0 });
  Object.defineProperty(window, 'visualViewport', { configurable: true, writable: true, value: viewport });
  const { container, unmount } = render(<Container><span>Login</span></Container>);
  const scene = container.querySelector('.login-scene') as HTMLElement;
  expect(document.documentElement).toHaveClass('kp-login-viewport');
  expect(scene.style.getPropertyValue('--login-viewport-height')).toBe('844px');

  act(() => {
    viewport.height = 340;
    viewport.offsetTop = 504;
    viewport.dispatchEvent(new Event('resize'));
    jest.advanceTimersByTime(16);
  });
  expect(scene.style.getPropertyValue('--login-viewport-height')).toBe('340px');
  expect(scene.style.getPropertyValue('--login-viewport-top')).toBe('504px');

  unmount();
  expect(document.documentElement).not.toHaveClass('kp-login-viewport');
});

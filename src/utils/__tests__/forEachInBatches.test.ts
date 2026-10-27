import { forEachInBatches } from '../forEachInBatches';

it('executa até quatro alterações independentes simultaneamente', async () => {
  let active = 0;
  let peak = 0;
  const completed: number[] = [];
  await forEachInBatches(Array.from({ length: 20 }, (_, index) => index), async (index) => {
    active += 1;
    peak = Math.max(peak, active);
    await Promise.resolve();
    completed.push(index);
    active -= 1;
  });
  expect(peak).toBe(4);
  expect(completed).toHaveLength(20);
});

it('aguarda as operações em curso e não inicia outro lote após uma falha', async () => {
  let finishPending!: () => void;
  const pending = new Promise<void>((resolve) => { finishPending = resolve; });
  const started: number[] = [];
  let finished = false;
  const job = forEachInBatches([1, 2, 3, 4, 5], async (id) => {
    started.push(id);
    if (id === 1) throw new Error('falha');
    await pending;
  }).finally(() => { finished = true; });
  await Promise.resolve();
  expect(finished).toBe(false);
  finishPending();
  await expect(job).rejects.toThrow('falha');
  expect(started).toEqual([1, 2, 3, 4]);
});

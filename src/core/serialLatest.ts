// Runs one job at a time. A call that arrives while a job is running is not lost and not run in
// parallel: when the job ends it runs once more with the NEWEST value given. So the last word wins
// (for example Asleep pressed while a rebook with older settings is already running).
export function serialLatest<T>(run: (value: T) => Promise<void>): (value: T) => Promise<void> {
  let running: Promise<void> | null = null;
  let waiting: { value: T } | null = null;
  return (value: T) => {
    if (running) {
      waiting = { value };
      return running;
    }
    running = (async () => {
      let next: { value: T } | null = { value };
      while (next) {
        waiting = null;
        await run(next.value);
        next = waiting;
      }
    })().finally(() => {
      running = null;
    });
    return running;
  };
}

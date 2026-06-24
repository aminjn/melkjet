// هوک بوتِ سرور (Next) — زمان‌بندِ سینکِ خودکارِ دیوار را در پروسهٔ Node راه می‌اندازد.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { ensureCronStarted } = await import('./app/lib/cron-runner')
    ensureCronStarted()
  }
}

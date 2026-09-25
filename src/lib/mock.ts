export function getMockDelayMs(): number {
  const delayStr = process.env.MOCK_API_DELAY_MS;
  if (delayStr) {
    const n = Number(delayStr);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return 0;
}

export async function mockDelay(): Promise<void> {
  const ms = getMockDelayMs();
  if (ms > 0) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}

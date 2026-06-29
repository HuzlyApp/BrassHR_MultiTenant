const DEFAULT_REDIS_TIMEOUT_MS = Number(process.env.CACHE_REDIS_TIMEOUT_MS ?? 3000) || 3000;
const DEFAULT_REDIS_COOLDOWN_MS =
  Number(process.env.CACHE_REDIS_FAILURE_COOLDOWN_MS ?? 60_000) || 60_000;

type RedisCircuitState = {
  unavailableUntil: number;
};

const redisCircuitState: RedisCircuitState =
  ((globalThis as typeof globalThis & { __brassRedisCircuit?: RedisCircuitState })
    .__brassRedisCircuit ??= { unavailableUntil: 0 });

export function getRedisTimeoutMs(): number {
  return DEFAULT_REDIS_TIMEOUT_MS;
}

export function isRedisCircuitOpen(): boolean {
  return redisCircuitState.unavailableUntil > Date.now();
}

export function markRedisUnavailable(): void {
  redisCircuitState.unavailableUntil = Date.now() + DEFAULT_REDIS_COOLDOWN_MS;
}

export function withRedisTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  const ms = getRedisTimeoutMs();
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise.finally(() => {
      if (timer) clearTimeout(timer);
    }),
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`redis timeout (${label}) after ${ms}ms`)), ms);
    }),
  ]);
}

import { registerHooks } from 'node:module';

const TS_HOOK_SYMBOL = Symbol.for('weather-buddy.node-ts-resolve-hook');

if (!globalThis[TS_HOOK_SYMBOL]) {
  registerHooks({
    resolve(specifier, context, nextResolve) {
      try {
        return nextResolve(specifier, context);
      } catch (err) {
        if (
          (specifier.startsWith('./') || specifier.startsWith('../')) &&
          !/\.[a-z0-9]+$/i.test(specifier)
        ) {
          return nextResolve(`${specifier}.ts`, context);
        }
        throw err;
      }
    },
    load(url, context, nextLoad) {
      if (url.endsWith('.ts') || url.endsWith('.tsx')) {
        return nextLoad(url, { ...context, format: 'module-typescript' });
      }
      return nextLoad(url, context);
    },
  });
  globalThis[TS_HOOK_SYMBOL] = true;
}

const core = await import('../src/core/index.ts');

export const {
  AUTO_REFRESH_INTERVAL_MINUTES,
  AUTO_REFRESH_INTERVAL_MS,
  PRESET_CITIES,
  DEMO_WEATHER_PRESETS,
  evaluateCharacterDecision,
  fetchWeatherSnapshot,
} = core;

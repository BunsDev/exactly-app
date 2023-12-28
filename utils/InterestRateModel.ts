import { WAD, expWad, lnWad, sqrtWad } from './FIxedPointMathLib';

export type FloatingParameters = {
  a: bigint;
  b: bigint;
  floatingNaturalUtilization: bigint;
  maxUtilization: bigint;
  sigmoidSpeed: bigint;
  growthSpeed: bigint;
  maxRate: bigint;
};

export type FixedParameters = FloatingParameters & {
  maxPools: bigint;
  maturity: bigint;
  timestamp?: bigint;
  spreadFactor: bigint;
  timePreference: bigint;
  maturitySpeed: bigint;
};

export function floatingRate(parameters: FloatingParameters, uFloating: bigint, uGlobal: bigint): bigint {
  const { a, b, maxUtilization, floatingNaturalUtilization, sigmoidSpeed, growthSpeed, maxRate } = parameters;

  const r = (a * WAD) / (maxUtilization - uFloating) + b;
  if (uGlobal === WAD) return maxRate;
  if (uGlobal === 0n) return r;
  if (uGlobal >= uFloating) {
    const sig =
      (WAD * WAD) /
      (WAD +
        expWad(
          (-sigmoidSpeed *
            (lnWad((uGlobal * WAD) / (WAD - uGlobal)) -
              lnWad((floatingNaturalUtilization * WAD) / (WAD - floatingNaturalUtilization)))) /
            WAD,
        ));
    const rate = (expWad((-growthSpeed * lnWad(WAD - (sig * uGlobal) / WAD)) / WAD) * r) / WAD;
    return rate > maxRate ? maxRate : rate;
  }
  return r;
}

export function fixedRate(parameters: FixedParameters, uFixed: bigint, uFloating: bigint, uGlobal: bigint): bigint {
  const { maxPools, spreadFactor, timePreference, maturitySpeed, floatingNaturalUtilization, maturity, timestamp } =
    parameters;
  const base = floatingRate(parameters, uFloating, uGlobal);
  if (uFixed === 0n) return base;
  console.log('after base');

  const fixedNaturalUtilization = WAD - floatingNaturalUtilization;
  const sqAlpha = (maxPools * WAD) / fixedNaturalUtilization;
  const alpha = sqrtWad(sqAlpha);
  const sqX = (maxPools * uFixed * WAD * WAD) / (uGlobal * fixedNaturalUtilization);
  const x = sqrtWad(sqX);
  const a = ((2n * WAD - sqAlpha) * WAD) / ((alpha * (WAD - alpha)) / WAD);
  const z = ((a * x + (WAD - a) * sqX) / WAD - WAD) / WAD;
  const time = timestamp !== undefined ? timestamp : BigInt(Date.now() / 1000);
  const ttm = maturity - time;
  const interval = 4n * 7n * 24n * 60n * 60n;
  const ttMaxM = time - (time % interval) + maxPools * interval;
  // check
  // maxPools * FixedLib.INTERVAL - (block.timestamp % FixedLib.INTERVAL)
  console.log({ time });
  console.log({ '(ttm * WAD) / ttMaxM': (ttm * WAD) / ttMaxM });
  console.log({ 'lnWad((ttm * WAD) / ttMaxM)': lnWad((ttm * WAD) / ttMaxM) });
  return (
    (base *
      (WAD +
        expWad((maturitySpeed * lnWad((ttm * WAD) / ttMaxM)) / WAD) * (timePreference + (spreadFactor * z) / WAD))) /
    WAD
  );
}

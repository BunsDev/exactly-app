import { useMemo } from 'react';

import useAccountData from './useAccountData';
import { floatingRate } from 'utils/interestRateCurve';

const MAX = 1;
const INTERVAL = 0.0005;

export function useCurrentUtilizationRate(type: 'floating' | 'fixed', symbol: string) {
  const { marketAccount } = useAccountData(symbol);

  return useMemo(() => {
    if (!marketAccount) return undefined;

    const { floatingUtilization, fixedPools } = marketAccount;
    if (!floatingUtilization || fixedPools === undefined) {
      return undefined;
    }

    const allUtilizations: Record<string, number>[] = [];

    if (type === 'fixed') {
      fixedPools.forEach((pool) => {
        allUtilizations.push({ maturity: Number(pool.maturity), utilization: Number(pool.utilization) / 1e18 });
      });
    }

    if (type === 'floating') {
      allUtilizations.push({ utilization: Number(floatingUtilization) / 1e18 });
    }
    return allUtilizations;
  }, [marketAccount, type]);
}

export default function useUtilizationRate(symbol: string, from = 0, to = MAX) {
  const { marketAccount } = useAccountData(symbol);

  const data = useMemo(() => {
    if (!marketAccount) {
      return [];
    }

    const { interestRateModel } = marketAccount;

    const { A, B, UMax } = {
      A: interestRateModel.floatingCurveA,
      B: interestRateModel.floatingCurveB,
      UMax: interestRateModel.floatingMaxUtilization,
    };

    // TODO(jg): replace 0.7 with natural utilization
    const model = floatingRate(Number(A) / 1e18, Number(B) / 1e18, Number(UMax) / 1e18, 2);

    const buckets = [0, 0.25, 0.5, 0.75, 1];

    const points: Record<string, number>[] = [];
    for (let u = from; u < to; u = u + INTERVAL) {
      const curves: Record<string, number> = {};
      for (let i = 0; i < buckets.length; i++) {
        const uliq = buckets[i];
        const r = model.rate(u, uliq);
        if (Number.isFinite(r)) {
          curves[`curve${i}`] = r;
        }
      }
      points.push({ utilization: u, ...curves });
    }

    console.log(points);

    return points;
  }, [marketAccount, from, to]);

  return { data, loading: !marketAccount };
}

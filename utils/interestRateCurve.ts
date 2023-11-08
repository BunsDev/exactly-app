import { WEI_PER_ETHER } from './const';

type InterestRateCurve = (u: number) => number;
type InverseInterestRateCurve = (apr: bigint) => bigint;

const abs = (n: bigint): bigint => (n < 0n ? -n : n);

export function inverseInterestRateCurve(a: bigint, b: bigint, uMax: bigint): InverseInterestRateCurve {
  return (apr: bigint) =>
    abs((((apr * uMax) / WEI_PER_ETHER - (b * uMax) / WEI_PER_ETHER - a) * WEI_PER_ETHER) / (b - apr));
}

// export function floatingRate(a: number, b: number, uMax: number, uNat: number) {
//   const auxUNat = Math.log(uNat / (1 - uNat));
//   const sigmoidSpeed = 1;
//   const growthSpeed = 1;
//   const uFactor = (1 / (1 - uNat / 2)) ^ growthSpeed;

//   const liquidity = (assets: number, debt: number, backupBorrowed: number): number | null => {
//     const liq = assets - debt - backupBorrowed;
//     if (liq < 0) {
//       return null;
//     }
//     return liq;
//   };

//   const utilization = (assets: number, debt: number): number | null => {
//     if (assets === 0) {
//       return null;
//     }
//     return debt / assets;
//   };

//   const uLiq = (assets: number, debt: number, backupBorrowed: number): number | null => {
//     const liq = liquidity(assets, debt, backupBorrowed);
//     if (liq === null) {
//       return null;
//     }
//     return 1 - liq / assets;
//   };

//   const rate = (assets: number, debt: number, backupBorrowed: number): number | null => {
//     const u = utilization(assets, debt);
//     if (u === null) {
//       return null;
//     }

//     const r = a / (uMax - u) + b;
//     const liq = liquidity(assets, debt, backupBorrowed);
//     if (liq === null || liq === 0) {
//       return r;
//     }

//     const uliq = uLiq(assets, debt, backupBorrowed);
//     if (uliq === null || uliq === 0) {
//       return r;
//     }

//     if (uliq < u) {
//       return null;
//     }

//     const sig = 1 / (1 + Math.exp(-sigmoidSpeed * Math.log(uliq / (1 - uliq)) - auxUNat));
//     return (uFactor * r) / (1 - sig * uliq);
//   };

//   return { liquidity, utilization, uLiq, rate };
// }

export function floatingRate(a: number, b: number, uMax: number, k: number) {
  const sigmoid = (x: number) => {
    return 1 / (1 + Math.exp(-x));
  };

  const rate = (u: number, uliq: number): number => {
    if (uMax < u) return Infinity;
    return (1 / ((1 - sigmoid(uliq) * uliq) ^ k)) * (a / (uMax - u) + b);
  };

  return { rate };
}

export default function interestRateCurve(a: number, b: number, uMax: number): InterestRateCurve {
  return (u: number) => (uMax >= u ? a / (uMax - u) + b : Infinity);
}

import { WEI_PER_ETHER } from './const';

type InterestRateCurve = (u: number) => number;
type InverseInterestRateCurve = (apr: bigint) => bigint;

const abs = (n: bigint): bigint => (n < 0n ? -n : n);

export function inverseInterestRateCurve(a: bigint, b: bigint, uMax: bigint): InverseInterestRateCurve {
  return (apr: bigint) =>
    abs((((apr * uMax) / WEI_PER_ETHER - (b * uMax) / WEI_PER_ETHER - a) * WEI_PER_ETHER) / (b - apr));
}

export function floatingRate(a: number, b: number, uMax: number, k: number) {
  const sigmoid = (x: number) => {
    return 1 / (1 + Math.exp(-x));
  };

  const rate = (u: number, uliq: number): number => {
    if (uMax < u) return Infinity;
    return (1 / (1 - sigmoid(uliq) * uliq) ** k) * (a / (uMax - u) + b);
  };

  return { rate };
}

export default function interestRateCurve(a: number, b: number, uMax: number): InterestRateCurve {
  return (u: number) => (uMax >= u ? a / (uMax - u) + b : Infinity);
}

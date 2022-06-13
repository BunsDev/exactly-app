import { ethers } from 'ethers';
import request from 'graphql-request';

import { getSmartPoolAccruedEarnings } from 'queries';

import getSubgraph from './getSubgraph';

async function getSmartPoolInterestRate(network: string, fixedLenderAddress: string) {
  const oneDay = 86400;

  const currentTimestamp = Math.floor(Date.now() / 1000);

  const subgraphUrl = getSubgraph(network);

  const smartPoolAccruedEarnings = await request(
    subgraphUrl,
    getSmartPoolAccruedEarnings(currentTimestamp - oneDay * 3, currentTimestamp, fixedLenderAddress)
  );

  if (smartPoolAccruedEarnings.smartPoolEarningsAccrueds.length == 0) return '0.00';

  let periodAccrued = 0;
  const newOperation = smartPoolAccruedEarnings.smartPoolEarningsAccrueds[0];

  const oldOperation =
    smartPoolAccruedEarnings.smartPoolEarningsAccrueds[
      smartPoolAccruedEarnings.smartPoolEarningsAccrueds.length - 1
    ];

  smartPoolAccruedEarnings.smartPoolEarningsAccrueds.forEach((event: any) => {
    periodAccrued += parseFloat(ethers.utils.formatEther(event.earnings));
  });

  const interestRate =
    (periodAccrued / parseFloat(ethers.utils.formatEther(oldOperation.previousAssets))) *
    ((oneDay * 365) / (newOperation.timestamp - oldOperation.timestamp)) *
    100;

  if (interestRate === Infinity || isNaN(interestRate)) return '0.00';

  return interestRate.toFixed(2);
}

export default getSmartPoolInterestRate;

import { useCallback, useMemo } from 'react';
import { encodeFunctionData, type EstimateContractGasParameters } from 'viem';
import { usePublicClient } from 'wagmi';
import { optimism } from 'wagmi/chains';
import { useWeb3 } from './useWeb3';
import { isE2E } from 'utils/client';
import { getAlchemyProvider } from 'utils/providers';
import { l1GasPriceOracleABI } from 'types/abi';

export default function useEstimateGas() {
  const { chain } = useWeb3();
  const e2ePublicClient = usePublicClient();
  const publicClient = useMemo(() => (isE2E ? e2ePublicClient : getAlchemyProvider(chain)), [chain, e2ePublicClient]);

  return useCallback(
    async (request?: EstimateContractGasParameters) => {
      if (!publicClient) return;

      let l1Gas = 0n;
      if (chain.id === optimism.id) {
        if (request) {
          const data = encodeFunctionData(request);
          l1Gas = await publicClient.readContract({
            abi: l1GasPriceOracleABI,
            address: '0x420000000000000000000000000000000000000F',
            functionName: 'getL1Fee',
            args: [data],
          });
        } else {
          l1Gas = 555_555_555_555n;
        }
      }
      const gasPrice = await publicClient.getGasPrice();
      const gasUsed = request ? await publicClient.estimateContractGas(request) : 500_000n;

      return gasPrice * gasUsed + l1Gas;
    },
    [publicClient, chain],
  );
}

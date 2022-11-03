import { useEffect, useState } from 'react';
import { Contract } from '@ethersproject/contracts';
import { MarketETHRouter } from 'types/contracts';
import MarketETHRouterABI from 'abi/MarketETHRouter.json';
import getNetworkName from 'utils/getNetworkName';
import { useWeb3Context } from 'contexts/Web3Context';

const useETHRouter = () => {
  const { web3Provider, network } = useWeb3Context();

  const [marketETHRouterContract, setMarketETHRouterContract] = useState<MarketETHRouter | undefined>(undefined);

  useEffect(() => {
    const loadMarketETHRouter = async () => {
      if (!network?.chainId) return;

      try {
        const { address } = await import(
          `protocol/deployments/${getNetworkName(network?.chainId)}/MarketETHRouter.json`,
          {
            assert: { type: 'json' },
          }
        );

        setMarketETHRouterContract(
          new Contract(address, MarketETHRouterABI, web3Provider?.getSigner()) as MarketETHRouter,
        );
      } catch (error) {
        console.log('Failed to load market ETH router');
        console.error(error);
      }
    };
    void loadMarketETHRouter();
  }, [network?.chainId, web3Provider]);

  return marketETHRouterContract;
};

export default useETHRouter;

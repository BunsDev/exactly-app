import { useCallback, useContext, useMemo } from 'react';
import { AbiParametersToPrimitiveTypes, ExtractAbiFunction } from 'abitype';

import AccountDataContext from 'contexts/AccountDataContext';
import usePreviewerExactly from 'hooks/usePreviewerExactly';
import { previewerABI } from 'types/abi';

export type MarketAccount = AbiParametersToPrimitiveTypes<
  ExtractAbiFunction<typeof previewerABI, 'exactly'>['outputs']
>[number][number];

type AccountDataHook = {
  marketAccount?: MarketAccount;
  accountData?: readonly MarketAccount[];
  lastSync?: number;
  isFetching: boolean;
  getMarketAccount: (symbol: string) => MarketAccount | undefined;
  refreshAccountData: (delay?: number) => Promise<readonly MarketAccount[] | undefined>;
};

function useAccountData(symbol: string): Omit<AccountDataHook, 'getMarketAccount'>;
function useAccountData(): Omit<AccountDataHook, 'marketAccount'>;
function useAccountData(
  symbol?: string,
): Omit<AccountDataHook, 'getMarketAccount'> | Omit<AccountDataHook, 'marketAccount'> {
  const { isLoading, isFetching, data, refetch } = usePreviewerExactly();

  const ctx = useContext(AccountDataContext);

  const getMarketAccount = useCallback(
    (_symbol: string) => (data ? data.find((ma) => ma.assetSymbol === _symbol) : undefined),
    [data],
  );

  const marketAccount = useMemo(() => (symbol ? getMarketAccount(symbol) : undefined), [symbol, getMarketAccount]);

  const refreshAccountData = useCallback(
    async (delay = 250) =>
      new Promise<readonly MarketAccount[] | undefined>((r) =>
        setTimeout(
          () =>
            refetch().then((marketAccounts) => {
              ctx?.resetLastSync();
              r(marketAccounts.data);
            }),
          delay,
        ),
      ),
    [refetch, ctx],
  );

  if (typeof symbol === 'undefined') {
    return {
      accountData: isLoading ? undefined : data,
      lastSync: ctx?.lastSync,
      isFetching,
      getMarketAccount,
      refreshAccountData,
    };
  }

  return {
    marketAccount,
    accountData: isLoading ? undefined : data,
    isFetching,
    lastSync: ctx?.lastSync,
    refreshAccountData,
  };
}

export default useAccountData;

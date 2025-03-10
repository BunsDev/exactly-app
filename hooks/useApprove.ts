import { useCallback, useState } from 'react';
import { parseUnits, type Address, type EstimateContractGasParameters, type Hex, formatUnits } from 'viem';
import { ERC20, Market } from 'types/contracts';
import { useWeb3 } from './useWeb3';
import { useOperationContext } from 'contexts/OperationContext';
import useAccountData from './useAccountData';
import handleOperationError from 'utils/handleOperationError';
import waitForTransaction from 'utils/waitForTransaction';
import { useTranslation } from 'react-i18next';

import { MAX_UINT256, WEI_PER_ETHER } from 'utils/const';
import useEstimateGas from './useEstimateGas';
import { gasLimit } from 'utils/gas';
import { track } from 'utils/segment';

function useApprove({
  operation,
  contract,
  spender,
}:
  | { operation: 'deposit' | 'depositAtMaturity' | 'repay' | 'repayAtMaturity'; contract?: ERC20; spender?: Address }
  | {
      operation: 'withdraw' | 'withdrawAtMaturity' | 'borrow' | 'borrowAtMaturity';
      contract?: Market;
      spender?: Address;
    }) {
  const { t } = useTranslation();
  const { walletAddress, opts } = useWeb3();
  const { qty, symbol, setErrorData, setLoadingButton } = useOperationContext();
  const [isLoading, setIsLoading] = useState(false);

  const { marketAccount } = useAccountData(symbol);

  const estimate = useEstimateGas();

  const estimateGas = useCallback(async () => {
    if (!contract || !spender || !walletAddress || !opts) return;

    let params: EstimateContractGasParameters;
    switch (operation) {
      case 'deposit':
      case 'depositAtMaturity':
      case 'repay':
      case 'repayAtMaturity': {
        const { request } = await contract.simulate.approve([spender, MAX_UINT256], opts);
        params = request;
        break;
      }
      case 'withdraw':
      case 'withdrawAtMaturity':
      case 'borrow':
      case 'borrowAtMaturity': {
        const { request } = await contract.simulate.approve([spender, MAX_UINT256], opts);
        params = request;
        break;
      }
    }

    if (!params) return;

    return estimate(params);
  }, [contract, spender, walletAddress, opts, operation, estimate]);

  const needsApproval = useCallback(
    async (amount: string): Promise<boolean> => {
      try {
        if (!walletAddress || !marketAccount || !contract || !spender) return true;

        const quantity = parseUnits(amount, marketAccount.decimals);

        switch (operation) {
          case 'deposit':
          case 'depositAtMaturity':
          case 'repay':
          case 'repayAtMaturity':
            if (symbol === 'WETH') return false;
            break;
          case 'borrow':
          case 'borrowAtMaturity':
          case 'withdraw':
          case 'withdrawAtMaturity': {
            if (symbol !== 'WETH') return false;
            const shares = await contract.read.previewWithdraw([quantity], opts);
            const allowance = await contract.read.allowance([walletAddress, spender], opts);
            return allowance < shares;
          }
        }

        const allowance = await contract.read.allowance([walletAddress, spender], opts);
        return allowance < quantity;
      } catch {
        return true;
      }
    },
    [operation, walletAddress, marketAccount, contract, spender, symbol, opts],
  );

  const approve = useCallback(async () => {
    if (!contract || !spender || !walletAddress || !marketAccount || !qty || !opts) return;

    try {
      let quantity = 0n;
      switch (operation) {
        case 'deposit':
        case 'depositAtMaturity':
          quantity = parseUnits(qty, marketAccount.decimals);
          break;
        case 'repay':
        case 'repayAtMaturity':
        case 'borrow':
        case 'borrowAtMaturity':
          quantity = (parseUnits(qty, marketAccount.decimals) * 101n) / 100n;
          break;
        case 'withdraw':
        case 'withdrawAtMaturity':
          quantity =
            ((await contract.read.previewWithdraw([parseUnits(qty, marketAccount.decimals)], opts)) * 101n) / 100n;
          break;
      }

      setIsLoading(true);
      setLoadingButton({ label: t('Sign the transaction on your wallet') });
      const args = [spender, quantity] as const;

      let hash: Hex;
      switch (operation) {
        case 'deposit':
        case 'depositAtMaturity':
        case 'repay':
        case 'repayAtMaturity': {
          const gas = await contract.estimateGas.approve(args, opts);
          hash = await contract.write.approve(args, {
            ...opts,
            gasLimit: gasLimit(gas),
          });
          break;
        }
        case 'withdraw':
        case 'withdrawAtMaturity':
        case 'borrow':
        case 'borrowAtMaturity': {
          const gas = await contract.estimateGas.approve(args, opts);
          hash = await contract.write.approve(args, {
            ...opts,
            gasLimit: gasLimit(gas),
          });
          break;
        }
      }
      track('TX Signed', {
        operation,
        hash,
        method: 'approve',
        contractName: 'Market',
        spender,
        amount: formatUnits(quantity, marketAccount.decimals),
        usdAmount: formatUnits((quantity * marketAccount.usdPrice) / WEI_PER_ETHER, marketAccount.decimals),
      });

      if (!hash) return;

      setLoadingButton({ withCircularProgress: true, label: t('Approving {{symbol}}', { symbol }) });
      const { status } = await waitForTransaction({ hash });
      if (status === 'reverted') throw new Error('Transaction reverted');
      track('TX Completed', {
        symbol,
        amount: formatUnits(quantity, marketAccount.decimals),
        usdAmount: formatUnits((quantity * marketAccount.usdPrice) / WEI_PER_ETHER, marketAccount.decimals),
        status,
        hash,
        operation,
      });
    } catch (error) {
      setErrorData({ status: true, message: handleOperationError(error) });
    } finally {
      setIsLoading(false);
      setLoadingButton({});
    }
  }, [
    contract,
    spender,
    walletAddress,
    marketAccount,
    opts,
    setLoadingButton,
    t,
    operation,
    qty,
    symbol,
    setErrorData,
  ]);

  return { approve, needsApproval, estimateGas, isLoading };
}

export default useApprove;

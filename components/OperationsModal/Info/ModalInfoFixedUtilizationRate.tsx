import React, { useCallback, useContext, useMemo, useState } from 'react';
import { BigNumber, formatFixed, parseFixed } from '@ethersproject/bignumber';
import PieChartOutlineRoundedIcon from '@mui/icons-material/PieChartOutlineRounded';

import ModalInfo, { FromTo, Variant } from 'components/common/modal/ModalInfo';
import { Operation } from 'contexts/ModalStatusContext';
import useAccountData from 'hooks/useAccountData';
import { toPercentage } from 'utils/utils';
import { MarketContext } from 'contexts/MarketContext';
import usePreviewer from 'hooks/usePreviewer';
import useDelayedEffect from 'hooks/useDelayedEffect';
import { useWeb3 } from 'hooks/useWeb3';
import { AddressZero } from '@ethersproject/constants';
import { useOperationContext } from 'contexts/OperationContext';

type Props = {
  qty: string;
  symbol: string;
  operation: Extract<Operation, 'depositAtMaturity' | 'withdrawAtMaturity' | 'borrowAtMaturity' | 'repayAtMaturity'>;
  variant?: Variant;
};

function ModalInfoFixedUtilizationRate({ qty, symbol, operation, variant = 'column' }: Props) {
  const previewerContract = usePreviewer();
  const { walletAddress } = useWeb3();
  const { marketAccount } = useAccountData(symbol);
  const { date } = useContext(MarketContext);

  const { marketContract } = useOperationContext();

  const from: string | undefined = useMemo(() => {
    if (!date) return;

    const pool = marketAccount?.fixedPools?.find(({ maturity }) => maturity.toNumber() === date);
    if (!pool) return;

    return toPercentage(Number(formatFixed(pool.utilization, 18)));
  }, [date, marketAccount]);

  const [to, setTo] = useState<string | undefined>();

  const preview = useCallback(async () => {
    if (!marketAccount || !marketContract || !previewerContract || !date) {
      return setTo(undefined);
    }
    if (!qty) {
      return setTo(from);
    }

    setTo(undefined);

    try {
      const initialAssets = parseFixed(qty, marketAccount.decimals);
      let uti: BigNumber | undefined = undefined;
      switch (operation) {
        case 'depositAtMaturity': {
          const { utilization } = await previewerContract.previewDepositAtMaturity(
            marketContract.address,
            date,
            initialAssets,
          );
          uti = utilization;
          break;
        }

        case 'withdrawAtMaturity': {
          const { utilization } = await previewerContract.previewWithdrawAtMaturity(
            marketContract.address,
            date,
            initialAssets,
            walletAddress ?? AddressZero,
          );
          uti = utilization;
          break;
        }
        case 'borrowAtMaturity': {
          const { utilization } = await previewerContract.previewBorrowAtMaturity(
            marketContract.address,
            date,
            initialAssets,
          );
          uti = utilization;
          break;
        }
        case 'repayAtMaturity': {
          const { utilization } = await previewerContract.previewRepayAtMaturity(
            marketContract.address,
            date,
            initialAssets,
            walletAddress ?? AddressZero,
          );
          uti = utilization;
          break;
        }
      }

      setTo(toPercentage(Number(formatFixed(uti, 18))));
    } catch {
      setTo('N/A');
    }
  }, [date, from, marketAccount, marketContract, operation, previewerContract, qty, walletAddress]);

  const { isLoading } = useDelayedEffect({ effect: preview });

  return (
    <ModalInfo label="Pool Utilization Rate" icon={PieChartOutlineRoundedIcon} variant={variant}>
      <FromTo from={from} to={isLoading ? undefined : to} variant={variant} />
    </ModalInfo>
  );
}

export default React.memo(ModalInfoFixedUtilizationRate);

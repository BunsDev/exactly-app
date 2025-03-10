import React, { FC, PropsWithChildren, useEffect } from 'react';

import ModalTxCost from 'components/OperationsModal/ModalTxCost';
import ModalGif from 'components/OperationsModal/ModalGif';

import { toPercentage } from 'utils/utils';

import { useOperationContext, usePreviewTx } from 'contexts/OperationContext';
import { Grid } from '@mui/material';
import { ModalBox, ModalBoxCell, ModalBoxRow } from 'components/common/modal/ModalBox';
import AssetInput from 'components/OperationsModal/AssetInput';
import DateSelector from 'components/OperationsModal/DateSelector';
import ModalInfoAPR from 'components/OperationsModal/Info/ModalInfoAPR';
import ModalInfoHealthFactor from 'components/OperationsModal/Info/ModalInfoHealthFactor';
import ModalInfoFixedUtilizationRate from 'components/OperationsModal/Info/ModalInfoFixedUtilizationRate';
import ModalAdvancedSettings from 'components/common/modal/ModalAdvancedSettings';
import ModalInfoBorrowLimit from 'components/OperationsModal/Info/ModalInfoBorrowLimit';
import ModalInfoEditableSlippage from 'components/OperationsModal/Info/ModalInfoEditableSlippage';
import ModalAlert from 'components/common/modal/ModalAlert';
import ModalSubmit from 'components/OperationsModal/ModalSubmit';
import useAccountData from 'hooks/useAccountData';
import useBorrowAtMaturity from 'hooks/useBorrowAtMaturity';
import ModalRewards from 'components/OperationsModal/ModalRewards';
import ModalPenaltyRate from 'components/OperationsModal/ModalPenaltyRate';
import { useTranslation } from 'react-i18next';
import useTranslateOperation from 'hooks/useTranslateOperation';

const BorrowAtMaturity: FC<PropsWithChildren> = ({ children }) => {
  const { t } = useTranslation();
  const translateOperation = useTranslateOperation();
  const { symbol, errorData, setErrorData, qty, gasCost, tx } = useOperationContext();
  const {
    isLoading,
    onMax,
    handleInputChange,
    handleSubmitAction,
    borrow,
    updateAPR,
    rawSlippage,
    setRawSlippage,
    fixedRate,
    hasCollateral,
    safeMaximumBorrow,
    needsApproval,
    previewGasCost,
  } = useBorrowAtMaturity();
  const { marketAccount } = useAccountData(symbol);

  useEffect(() => void updateAPR(), [updateAPR]);
  useEffect(() => {
    if (!hasCollateral) {
      setErrorData({
        status: true,
        variant: 'warning',
        message: t(
          'In order to borrow you need to have a deposit in the Variable Rate Pool marked as collateral in your Dashboard',
        ),
      });
    }
  }, [hasCollateral, setErrorData, t]);

  const { isLoading: previewIsLoading } = usePreviewTx({ qty, needsApproval, previewGasCost });

  if (tx) return <ModalGif tx={tx} tryAgain={borrow} />;

  return (
    <Grid container flexDirection="column">
      <Grid item>
        <ModalBox>
          <ModalBoxRow>
            <AssetInput
              qty={qty}
              symbol={symbol}
              decimals={marketAccount?.decimals ?? 18}
              onMax={onMax}
              onChange={handleInputChange}
              label={t('Safe borrow limit')}
              amount={safeMaximumBorrow}
              tooltip={t('The maximum amount you can borrow without putting your health factor at risk')}
            />
          </ModalBoxRow>
          <ModalBoxRow>
            <ModalBoxCell>
              <DateSelector />
            </ModalBoxCell>
            <ModalBoxCell>
              <ModalInfoAPR apr={toPercentage(Number(fixedRate) / 1e18)} symbol={symbol} />
            </ModalBoxCell>
          </ModalBoxRow>
          <ModalBoxRow>
            <ModalBoxCell>
              <ModalInfoHealthFactor qty={qty} symbol={symbol} operation="borrowAtMaturity" />
            </ModalBoxCell>
            <ModalBoxCell divisor>
              <ModalInfoBorrowLimit qty={qty} symbol={symbol} operation="borrowAtMaturity" />
            </ModalBoxCell>
          </ModalBoxRow>
        </ModalBox>
      </Grid>

      <Grid item mt={2}>
        {errorData?.component !== 'gas' && <ModalTxCost gasCost={gasCost} />}
        <ModalRewards symbol={symbol} operation="borrow" />
        <ModalPenaltyRate symbol={symbol} />
        <ModalAdvancedSettings>
          <ModalInfoEditableSlippage value={rawSlippage} onChange={(e) => setRawSlippage(e.target.value)} />
          <ModalInfoFixedUtilizationRate
            qty={qty}
            symbol={symbol}
            operation="borrowAtMaturity"
            variant="row"
            fixedRate={fixedRate}
          />
        </ModalAdvancedSettings>
        {children}
      </Grid>

      {errorData?.status && (
        <Grid item mt={1}>
          <ModalAlert variant={errorData.variant} message={errorData.message} />
        </Grid>
      )}

      <Grid item mt={{ xs: 2, sm: 3 }}>
        <ModalSubmit
          label={translateOperation('borrowAtMaturity', { capitalize: true })}
          symbol={symbol === 'WETH' && marketAccount ? marketAccount.symbol : symbol}
          submit={handleSubmitAction}
          isLoading={isLoading || previewIsLoading}
          disabled={!qty || parseFloat(qty) <= 0 || isLoading || previewIsLoading || errorData?.status}
        />
      </Grid>
    </Grid>
  );
};

export default React.memo(BorrowAtMaturity);

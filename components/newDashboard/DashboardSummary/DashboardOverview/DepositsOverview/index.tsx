import React from 'react';
import { formatUnits } from 'viem';
import { DepositIcon } from 'components/Icons';
import useDashboardOverview from 'hooks/useDashboardOverview';
import { useTranslation } from 'react-i18next';
import formatNumber from 'utils/formatNumber';
import { toPercentage } from 'utils/utils';
import OverviewCard from '../OverviewCard';
import OverviewPositionBars from '../OverviewPositionBars';

const DepositsOverview = () => {
  const { t } = useTranslation();
  const { totalUSD, assetPositions, totalFixedUSD, totalFloatingUSD, fixedPercentage, floatingPercentage } =
    useDashboardOverview('deposit');

  return (
    <OverviewCard
      title={t('deposits')}
      icon={<DepositIcon sx={{ fontSize: 12 }} />}
      total={totalUSD ? `$${formatNumber(formatUnits(totalUSD, 18), 'USD', true)}` : undefined}
      fixedValue={totalFixedUSD ? `$${formatNumber(formatUnits(totalFixedUSD, 18), 'USD', true)}` : undefined}
      floatingValue={totalFloatingUSD ? `$${formatNumber(formatUnits(totalFloatingUSD, 18), 'USD', true)}` : undefined}
      subFixedValue={fixedPercentage ? toPercentage(Number(fixedPercentage) / 1e18) : undefined}
      subFloatingValue={floatingPercentage ? toPercentage(Number(floatingPercentage) / 1e18) : undefined}
      viewAll
    >
      <OverviewPositionBars assets={assetPositions} />
    </OverviewCard>
  );
};

export default DepositsOverview;

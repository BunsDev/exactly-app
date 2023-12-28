import React, { useEffect } from 'react';
import { basename } from 'path';
import { readdir, readFile } from 'fs/promises';
import type { GetStaticPaths, GetStaticProps, NextPage } from 'next';
import AssetMaturityPools from 'components/asset/MaturityPool';
import AssetFloatingPool from 'components/asset/FloatingPool';
import AssetHeaderInfo from 'components/asset/Header';

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Box, IconButton, Tooltip, Typography, Grid } from '@mui/material';
import Link from 'next/link';
import useRouter from 'hooks/useRouter';
import { useTranslation } from 'react-i18next';
import { floatingRate, type FloatingParameters, FixedParameters, fixedRate } from 'utils/InterestRateModel';

type Props = {
  symbol: string;
};

const Market: NextPage<Props> = ({ symbol }: Props) => {
  const { t } = useTranslation();
  const { query } = useRouter();

  useEffect(() => {
    const parameters: FloatingParameters = {
      a: 13829000000000000n,
      b: 17429000000000000n,
      maxUtilization: 1100000000000000000n,
      floatingNaturalUtilization: 700000000000000000n,
      sigmoidSpeed: 2500000000000000000n,
      growthSpeed: 1000000000000000000n,
      maxRate: 150000000000000000000n,
    };
    let uFloating = 0n,
      uGlobal = 0n;
    let rate = floatingRate(parameters, uFloating, uGlobal);

    console.log('***********************************');
    console.log({ uFloating, uGlobal, rate });
    uFloating = uGlobal = 500000000000000000n;
    rate = floatingRate(parameters, uFloating, uGlobal);
    console.log({ uFloating, uGlobal, rate });
    uFloating = uGlobal = 700000000000000000n;
    rate = floatingRate(parameters, uFloating, uGlobal);
    console.log({ uFloating, uGlobal, rate });
    console.log('***********************************');

    // maxPools: bigint;
    // maturity: bigint;
    // timestamp?: bigint;
    // spreadFactor: bigint;
    // timePreference: bigint;
    // maturitySpeed: bigint;
    const fixedParameters: FixedParameters = {
      ...parameters,
      timestamp: 0n,
      maxPools: 6n,
      maturity: 86400n,
      spreadFactor: 200000000000000000n,
      timePreference: 0n,
      maturitySpeed: 500000000000000000n,
    };

    let uFixed = (uFloating = uGlobal = 0n);
    rate = fixedRate(fixedParameters, uFixed, uFloating, uGlobal);
    console.log({ uFixed, uFloating, uGlobal, rate });
    console.log('***********************************');

    fixedParameters.timestamp = fixedParameters.timestamp || 0n + 86_400_000n * 11n;
    console.log('11 days later');
    rate = fixedRate(fixedParameters, uFixed, uFloating, uGlobal);
    console.log({ uFixed, uFloating, uGlobal, rate });
    console.log('***********************************');

    fixedParameters.timestamp = fixedParameters.timestamp || 0n + 86_400_000n * 5n;
    console.log('5 days later');
    uFixed = 500000000000000000n;
    uFloating = 300000000000000000n;
    uGlobal = 900000000000000000n;
    rate = fixedRate(fixedParameters, uFixed, uFloating, uGlobal);
    console.log({ uFixed, uFloating, uGlobal, rate });
    console.log('***********************************');

    fixedParameters.timestamp = fixedParameters.timestamp || 0n + 86_400_000n * 5n;
    console.log('5 days later');
    uFixed = 700000000000000000n;
    uFloating = 200000000000000000n;
    uGlobal = 900000000000000000n;
    rate = fixedRate(fixedParameters, uFixed, uFloating, uGlobal);
    console.log({ uFixed, uFloating, uGlobal, rate });
    console.log('***********************************');
  }, []);

  return (
    <Grid container mt={-1}>
      <Box sx={{ display: 'flex', gap: 0.5 }} mb={1}>
        <Link href={{ pathname: '/', query }} legacyBehavior>
          <IconButton size="small">
            <Tooltip title={t('Go Back')} placement="top">
              <ArrowBackIcon fontSize="small" />
            </Tooltip>
          </IconButton>
        </Link>
        <Typography color="grey.500" sx={{ fontSize: '13px', fontWeight: 600, my: 'auto' }}>
          {t('Back')}
        </Typography>
      </Box>
      <AssetHeaderInfo symbol={symbol} />
      <Box display="flex" flexDirection={{ xs: 'column', sm: 'row' }} my="16px" gap="16px">
        <Box maxWidth={{ xs: '100%', sm: '50%' }}>
          <AssetFloatingPool symbol={symbol} />
        </Box>
        <Box maxWidth={{ xs: '100%', sm: '50%' }}>
          <AssetMaturityPools symbol={symbol} />
        </Box>
      </Box>
    </Grid>
  );
};

export default Market;

export const getStaticPaths: GetStaticPaths<Props> = async () => {
  const deploymentsDir = 'node_modules/@exactly/protocol/deployments';
  const networks = await readdir(deploymentsDir);
  const markets = await Promise.all(
    networks.map(async (network) => {
      try {
        await readFile(`${deploymentsDir}/${network}/.chainId`);
        return (await readdir(`${deploymentsDir}/${network}`))
          .map((filename) => basename(filename, '.json'))
          .filter((name) => name.startsWith('Market') && !name.includes('_') && !name.includes('Router'))
          .map((name) => name.replace(/^Market/, ''));
      } catch {
        return [];
      }
    }),
  );
  return {
    paths: Array.from(new Set(markets.flat())).map((symbol) => ({ params: { symbol } })),
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps<Props, Props> = ({ params }) => {
  if (!params) throw new Error('missing params');
  return { props: { symbol: params.symbol } };
};

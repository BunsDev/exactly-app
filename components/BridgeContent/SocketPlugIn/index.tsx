import React, { memo, useCallback, useMemo, useState } from 'react';

import dynamic from 'next/dynamic';
import { useNetwork } from 'wagmi';
import { useTranslation } from 'react-i18next';
import { Box, useMediaQuery, useTheme } from '@mui/material';

import { Network, WidgetProps, transactionDetails } from '@socket.tech/plugin';
import useEthersProvider from 'hooks/useEthersProvider';
import { optimism } from 'viem/chains';
import { tokens } from './tokens.json';
import useAnalytics from 'hooks/useAnalytics';
import { hexToRgb } from './utils';
import useAssets from 'hooks/useAssets';

const DynamicBridge = dynamic(() => import('@socket.tech/plugin').then((mod) => mod.Bridge), {
  ssr: false,
});

type Props = {
  updateRoutes: () => void;
};

/**
 * Wrapper used to re-render each time defaultSourceNetwork changes
 */
const PlugInWrapper = (props: WidgetProps) => <DynamicBridge {...props} key={props.defaultSourceNetwork} />;

const SocketPlugIn = ({ updateRoutes }: Props) => {
  const { chain } = useNetwork();
  const { palette } = useTheme();
  const { t } = useTranslation();
  const provider = useEthersProvider();
  const { transaction } = useAnalytics();
  const [destinationNetwork, setDestinationNetwork] = useState<Network | undefined>();
  const [sourceNetwork, setSourceNetwork] = useState<Network | undefined>();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const assets = useAssets();

  const tokenList = useMemo(
    () =>
      tokens
        .filter(({ chainId, symbol }) => {
          const isBridgeToOPMainnet =
            destinationNetwork?.chainId === optimism.id && sourceNetwork?.chainId !== optimism.id;
          const isSourceToken = chainId === sourceNetwork?.chainId;

          return isBridgeToOPMainnet
            ? isSourceToken || assets.includes(symbol)
            : isSourceToken || chainId === destinationNetwork?.chainId;
        })
        .sort((t1, t2) => (assets.includes(t1.symbol) && !assets.includes(t2.symbol) ? -1 : 1)),
    [assets, destinationNetwork?.chainId, sourceNetwork?.chainId],
  );

  const handleSourceNetworkChange = useCallback(setSourceNetwork, [setSourceNetwork]);

  const handleDestinationNetworkChange = useCallback(setDestinationNetwork, [setDestinationNetwork]);

  const handleSubmit = useCallback(
    ({ sourceToken, destinationToken, sourceAmount, destinationAmount }: transactionDetails) => {
      updateRoutes();
      const bridgeInput = {
        sourceChainId: sourceNetwork?.chainId,
        sourceToken: sourceToken.symbol,
        destinationChainId: destinationNetwork?.chainId,
        destinationToken: destinationToken.symbol,
        sourceAmount,
        destinationAmount,
      };
      transaction.addToCart('bridge', bridgeInput);
    },
    [destinationNetwork?.chainId, updateRoutes, sourceNetwork?.chainId, transaction],
  );

  const handleSuccess = useCallback(
    ({ sourceToken, destinationToken, sourceAmount, destinationAmount }: transactionDetails) => {
      updateRoutes();
      const bridgeInput = {
        sourceChainId: sourceNetwork?.chainId,
        sourceToken: sourceToken.symbol,
        destinationChainId: destinationNetwork?.chainId,
        destinationToken: destinationToken.symbol,
        sourceAmount,
        destinationAmount,
      };

      transaction.purchase('bridge', bridgeInput);
    },
    [destinationNetwork?.chainId, updateRoutes, sourceNetwork?.chainId, transaction],
  );

  return (
    <Box
      borderRadius={1}
      display="flex"
      justifyContent="center"
      boxShadow="0px 3px 4px 0px #61666B1A"
      position={{ sm: 'relative', md: 'sticky' }}
      top={{ sm: undefined, md: 4 }}
      p={1.5}
      bgcolor="components.bg"
      sx={{
        '& ::-webkit-scrollbar': {
          '-webkit-appearance': 'none',
          width: 1,
        },
        '& ::-webkit-scrollbar-thumb': {
          'border-radius': 0.5,
          'background-color': 'rgba(0,0,0,.5)',
          '-webkit-box-shadow': '0 0 1px rgba(255,255,255,.5)',
        },
        '& .skt-w-max-h-\\[150px\\]': {
          maxHeight: '165px !important',
          boxShadow: '0px 3px 4px rgba(97, 102, 107, 0.1)',
        },
        '& .skt-w-bg-black': {
          backgroundColor: 'transparent !important',
        },
      }}
      alignSelf="start"
      minWidth={isMobile ? 348 : 448}
      minHeight={448}
    >
      <PlugInWrapper
        provider={provider}
        enableSameChainSwaps
        API_KEY={process.env.NEXT_PUBLIC_SOCKET_API_KEY || ''}
        defaultSourceNetwork={chain?.id || 10}
        defaultDestNetwork={optimism.id}
        customize={{
          primary: hexToRgb(palette.components.bg),
          secondary: hexToRgb(palette.components.bg),
          text: hexToRgb(palette.text.primary),
          secondaryText: hexToRgb(palette.text.primary),
          interactive: hexToRgb(palette.grey[200]),
          outline: hexToRgb(palette.text.primary),
          accent: hexToRgb(palette.text.primary),
          onInteractive: hexToRgb(palette.text.primary),
          onAccent: hexToRgb(palette.components.bg),
          width: isMobile ? 348 : 448,
          borderRadius: 0.5,
        }}
        title={t('Select network and assets')}
        onSubmit={handleSubmit}
        onBridgeSuccess={handleSuccess}
        onSourceNetworkChange={handleSourceNetworkChange}
        onDestinationNetworkChange={handleDestinationNetworkChange}
        tokenList={tokenList}
        locale="es AR"
      />
    </Box>
  );
};

export default memo(SocketPlugIn);

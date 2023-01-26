import '../styles/globals.css';
import '../styles/variables.css';

import React from 'react';
import Head from 'next/head';
import { Web3Modal } from '@web3modal/react';
import { WagmiConfig } from 'wagmi';
import type { AppProps } from 'next/app';
import { Box, Grid } from '@mui/material';
import { ThemeProvider as MUIThemeProvider } from '@mui/material/styles';

import { ModalStatusProvider } from 'contexts/ModalStatusContext';
import { MarketProvider } from 'contexts/MarketContext';
import { AccountDataProvider } from 'contexts/AccountDataContext';
import { ThemeProvider } from 'contexts/ThemeContext';
import { defaultChain, wagmi, walletConnectId, web3modal } from 'utils/client';
import Footer from 'components/Footer';
import Navbar from 'components/Navbar';
import theme, { globals } from 'styles/theme';

const { maxWidth } = globals;

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>Exactly - Decentralizing the time-value of money</title>
        <meta name="description" content="Exactly - Decentralizing the time-value of money" />
        <link rel="icon" href="/icon.ico" />
      </Head>
      <ThemeProvider>
        <MUIThemeProvider theme={theme}>
          <WagmiConfig client={wagmi}>
            <AccountDataProvider>
              <MarketProvider>
                <ModalStatusProvider>
                  <Grid maxWidth={maxWidth} mx="auto" height="100%">
                    <Box display="flex" flexDirection="column" mx={1} height="100%">
                      <Navbar />
                      <main style={{ flexGrow: 1 }}>
                        <Component {...pageProps} />
                      </main>
                      <Footer />
                    </Box>
                  </Grid>
                </ModalStatusProvider>
              </MarketProvider>
            </AccountDataProvider>
          </WagmiConfig>
          <Web3Modal
            projectId={walletConnectId}
            defaultChain={defaultChain}
            ethereumClient={web3modal}
            themeMode="light"
            themeColor="blackWhite"
            themeBackground="themeColor"
            walletImages={{ safe: '/img/wallets/safe.png' }}
            chainImages={{ 1: '/img/networks/1.svg' }}
          />
        </MUIThemeProvider>
      </ThemeProvider>
    </>
  );
}

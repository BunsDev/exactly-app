import { useContext, useEffect, useState } from 'react';
import { providers } from 'ethers';

import styles from './style.module.scss';

import keys from './translations.json';

import { formatWallet } from 'utils/utils';

import LangContext from 'contexts/LangContext';

import { LangKeys } from 'types/Lang';
import { Network } from 'types/Network';

type Props = {
  walletAddress: string;
  cogwheel?: Boolean;
  network?: Network | null | undefined;
  disconnect: () => Promise<void>;
};

function Wallet({ walletAddress, cogwheel = true, network, disconnect }: Props) {
  const lang: string = useContext(LangContext);

  const translations: { [key: string]: LangKeys } = keys;
  const formattedWallet = walletAddress && formatWallet(walletAddress);
  const [walletContainer, setWalletContainer] = useState<Boolean>(false);
  const [ens, setEns] = useState<string | null>(null);

  function handleWallet() {
    setWalletContainer((prev) => !prev);
  }

  useEffect(() => {
    if (!walletAddress) return;
    getENS(walletAddress);
  }, [walletAddress]);

  async function getENS(walletAddress: string) {
    const ens = await providers.getDefaultProvider().lookupAddress(walletAddress);

    setEns(ens);
  }

  return (
    <div className={styles.container}>
      <p className={styles.wallet} onClick={handleWallet}>
        {ens ? ens : formattedWallet}
      </p>
      {cogwheel && (
        <img
          src={`/img/icons/${walletContainer ? 'arrowUp' : 'arrowDown'}.svg`}
          alt="settings"
          onClick={handleWallet}
        />
      )}
      {network && (
        <div className={styles.networkContainer}>
          <div className={styles.dot} />
          <p className={styles.network}> {network?.name}</p>
        </div>
      )}

      {walletContainer && (
        <div className={styles.walletContainer}>
          {walletAddress && (
            <p className={styles.disconnect} onClick={() => disconnect && disconnect()}>
              <img src="/img/icons/power.svg" />
              {translations[lang].disconnect}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default Wallet;

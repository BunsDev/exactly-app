import { ChangeEvent, useContext, useEffect, useState } from 'react';
import { Contract, ethers } from 'ethers';

import Button from 'components/common/Button';
import ModalAsset from 'components/common/modal/ModalAsset';
import ModalClose from 'components/common/modal/ModalClose';
import ModalInput from 'components/common/modal/ModalInput';
import ModalRow from 'components/common/modal/ModalRow';
import ModalTitle from 'components/common/modal/ModalTitle';
import ModalTxCost from 'components/common/modal/ModalTxCost';
import ModalMinimized from 'components/common/modal/ModalMinimized';
import ModalGif from 'components/common/modal/ModalGif';
import Overlay from 'components/Overlay';

import { Borrow } from 'types/Borrow';
import { Deposit } from 'types/Deposit';
import { LangKeys } from 'types/Lang';
import { UnderlyingData } from 'types/Underlying';
import { Gas } from 'types/Gas';
import { Transaction } from 'types/Transaction';

import { getContractData } from 'utils/contracts';
import { getUnderlyingData } from 'utils/utils';

import styles from './style.module.scss';

import LangContext from 'contexts/LangContext';
import { useWeb3Context } from 'contexts/Web3Context';
import FixedLenderContext from 'contexts/FixedLenderContext';
import { AddressContext } from 'contexts/AddressContext';

import keys from './translations.json';

type Props = {
  data: Borrow | Deposit;
  closeModal: (props: any) => void;
};

function BorrowModal({ data, closeModal }: Props) {
  const { symbol } = data;

  const { web3Provider, walletAddress } = useWeb3Context();

  const { date } = useContext(AddressContext);

  const lang: string = useContext(LangContext);
  const translations: { [key: string]: LangKeys } = keys;

  const fixedLenderData = useContext(FixedLenderContext);

  const [qty, setQty] = useState<string>('0');
  const [walletBalance, setWalletBalance] = useState<string | undefined>(undefined);
  const [gas, setGas] = useState<Gas | undefined>(undefined);
  const [tx, setTx] = useState<Transaction | undefined>(undefined);
  const [minimized, setMinimized] = useState<Boolean>(false);

  const [fixedLenderWithSigner, setFixedLenderWithSigner] = useState<Contract | undefined>(
    undefined
  );

  let underlyingData: UnderlyingData | undefined = undefined;

  if (symbol) {
    underlyingData = getUnderlyingData(process.env.NEXT_PUBLIC_NETWORK!, symbol.toLowerCase());
  }

  const underlyingContract = getContractData(underlyingData!.address, underlyingData!.abi);

  useEffect(() => {
    getFixedLenderContract();
    getWalletBalance();
  }, []);

  useEffect(() => {
    if (fixedLenderWithSigner && !gas) {
      estimateGas();
    }
  }, [fixedLenderWithSigner]);

  async function getWalletBalance() {
    const walletBalance = await underlyingContract?.balanceOf(walletAddress);

    const formattedBalance = walletBalance && ethers.utils.formatEther(walletBalance);

    if (formattedBalance) {
      setWalletBalance(formattedBalance);
    }
  }

  async function onMax() {
    walletBalance && setQty(walletBalance);
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    setQty(e.target.value);
  }

  async function borrow() {
    const borrow = await fixedLenderWithSigner?.borrowAtMaturity(
      parseInt(date!.value),
      ethers.utils.parseUnits(qty!),
      ethers.utils.parseUnits(qty!),
      walletAddress,
      walletAddress
    );

    setTx({ status: 'processing', hash: borrow?.hash });

    const status = await borrow.wait();

    setTx({ status: 'success', hash: status?.transactionHash });
  }

  async function estimateGas() {
    const gasPriceInGwei = await fixedLenderWithSigner?.provider.getGasPrice();

    const estimatedGasCost = await fixedLenderWithSigner?.estimateGas.borrowAtMaturity(
      parseInt(date!.value),
      ethers.utils.parseUnits(qty!),
      ethers.utils.parseUnits(qty!),
      walletAddress,
      walletAddress
    );

    if (gasPriceInGwei && estimatedGasCost) {
      const gwei = await ethers.utils.formatUnits(gasPriceInGwei, 'gwei');
      const gasCost = await ethers.utils.formatUnits(estimatedGasCost, 'gwei');
      const eth = parseFloat(gwei) * parseFloat(gasCost);

      setGas({ eth: eth.toFixed(8), gwei: parseFloat(gwei).toFixed(1) });
    }
  }

  async function getFixedLenderContract() {
    const filteredFixedLender = fixedLenderData.find((contract) => {
      const args: Array<string> | undefined = contract?.args;
      const contractSymbol: string | undefined = args && args[1];

      return contractSymbol == symbol;
    });

    const fixedLender = await getContractData(
      filteredFixedLender?.address!,
      filteredFixedLender?.abi!,
      web3Provider?.getSigner()
    );

    setFixedLenderWithSigner(fixedLender);
  }

  return (
    <>
      {!minimized && (
        <section className={styles.formContainer}>
          {!tx && (
            <>
              <ModalTitle title={translations[lang].borrow} />
              <ModalAsset asset={symbol} amount={walletBalance} />
              <ModalClose closeModal={closeModal} />
              <ModalRow text={translations[lang].maturityPool} value={date?.label} />
              <ModalInput onMax={onMax} value={qty} onChange={handleInputChange} />
              {gas && <ModalTxCost gas={gas} />}
              <ModalRow text={translations[lang].interestRate} value="X %" line />
              <ModalRow text={translations[lang].interestRateSlippage} value={'X %'} line />
              <ModalRow text={translations[lang].maturityDebt} value={'X %'} line />
              <ModalRow text={translations[lang].healthFactor} values={['1,1', '1,8']} />
              <div className={styles.buttonContainer}>
                <Button
                  text={translations[lang].borrow}
                  className={qty <= '0' || !qty ? 'disabled' : 'secondary'}
                  onClick={borrow}
                />
              </div>
            </>
          )}
          {tx && <ModalGif tx={tx} />}
        </section>
      )}

      {tx && minimized && (
        <ModalMinimized
          tx={tx}
          handleMinimize={() => {
            setMinimized((prev) => !prev);
          }}
        />
      )}

      {!minimized && (
        <Overlay
          closeModal={
            !tx || tx.status == 'success'
              ? closeModal
              : () => {
                  setMinimized((prev) => !prev);
                }
          }
        />
      )}
    </>
  );
}

export default BorrowModal;

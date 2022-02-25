import { useEffect, useState, useContext } from 'react';
import { ethers } from 'ethers';

import style from './style.module.scss';

import Input from 'components/common/Input';
import Button from 'components/common/Button';
import MaturitySelector from 'components/MaturitySelector';
import Tooltip from 'components/Tooltip';

import useContractWithSigner from 'hooks/useContractWithSigner';
import useContract from 'hooks/useContract';

import { SupplyRate } from 'types/SupplyRate';
import { Error } from 'types/Error';
import { Market } from 'types/Market';
import { LangKeys } from 'types/Lang';
import { Transaction } from 'types/Transaction';

import keys from './translations.json';

import { AddressContext } from 'contexts/AddressContext';
import FixedLenderContext from 'contexts/FixedLenderContext';
import InterestRateModelContext from 'contexts/InterestRateModelContext';
import LangContext from 'contexts/LangContext';
import PoolAccountingContext from 'contexts/PoolAccountingContext';

type Props = {
  contractWithSigner: ethers.Contract;
  handleResult: (data: SupplyRate | undefined) => void;
  hasRate: boolean | undefined;
  address: string;
  assetData: Market | undefined;
  handleTx: (data: Transaction) => void;
};

function BorrowForm({
  contractWithSigner,
  handleResult,
  hasRate,
  address,
  assetData,
  handleTx
}: Props) {
  const lang: string = useContext(LangContext);
  const translations: { [key: string]: LangKeys } = keys;

  const { date } = useContext(AddressContext);
  const fixedLender = useContext(FixedLenderContext);
  const interestRateModel = useContext(InterestRateModelContext);

  const poolAccountingData = useContext(PoolAccountingContext);
  const poolAccounting = useContract(
    poolAccountingData?.address!,
    poolAccountingData.abi!
  );

  const [qty, setQty] = useState<number | undefined>(undefined);

  const [error, setError] = useState<Error | undefined>({
    status: false,
    msg: ''
  });

  const interestRateModelContract = useContract(
    interestRateModel.address!,
    interestRateModel.abi!
  );
  const fixedLenderWithSigner = useContractWithSigner(
    address,
    fixedLender?.abi!
  );

  useEffect(() => {
    calculateRate();
  }, [qty, date]);

  async function calculateRate() {
    if (!qty || !date) {
      handleLoading(true);
      return setError({ status: true, msg: translations[lang].amountError });
    }

    handleLoading(false);

    const smartPoolBorrowed =
      await poolAccounting.contract?.smartPoolBorrowed();

    const smartPoolSupplied =
      await fixedLenderWithSigner?.contract?.getSmartPoolDeposits();

    const currentTimestamp = Math.floor(Date.now() / 1000);

    //Borrow
    try {
      const borrowRate =
        await interestRateModelContract?.contract?.getRateToBorrow(
          parseInt(date.value),
          currentTimestamp,
          smartPoolBorrowed,
          smartPoolSupplied,
          ethers.utils.parseUnits('2000', 18)
        );

      const formattedBorrowRate =
        borrowRate && ethers.utils.formatEther(borrowRate);

      formattedBorrowRate &&
        handleResult({ potentialRate: formattedBorrowRate, hasRate: true });
    } catch (e) {
      console.log(e);
      return setError({ status: true, msg: translations[lang].error });
    }
  }

  async function borrow() {
    if (!qty || !date) {
      return setError({ status: true, msg: translations[lang].error });
    }

    try {
      const tx =
        await fixedLenderWithSigner?.contractWithSigner?.borrowFromMaturityPool(
          ethers.utils.parseUnits(qty!.toString()),
          parseInt(date.value),
          ethers.utils.parseUnits('1000')
        );

      handleTx({ status: 'processing', hash: tx?.hash });

      const status = await tx.wait();

      handleTx({ status: 'success', hash: status?.transactionHash });
    } catch (e) {
      console.log(e);
    }
  }

  function handleLoading(hasRate: boolean) {
    handleResult({ potentialRate: undefined, hasRate: hasRate });
  }

  return (
    <>
      <div className={style.fieldContainer}>
        <span>{translations[lang].borrowTitle}</span>
        <div className={style.inputContainer}>
          <Input
            type="number"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setQty(e.target.valueAsNumber);
              setError({ status: false, msg: '' });
            }}
            value={qty}
            placeholder="0"
          />
        </div>
      </div>
      <div className={style.fieldContainer}>
        <div className={style.titleContainer}>
          <span>{translations[lang].endDate}</span>
          <Tooltip value={translations[lang].endDate} />
        </div>
        <div className={style.inputContainer}>
          <MaturitySelector />
        </div>
      </div>
      {error?.status && <p className={style.error}>{error?.msg}</p>}
      <div className={style.fieldContainer}>
        <div className={style.buttonContainer}>
          <Button
            text={translations[lang].borrow}
            onClick={borrow}
            className={qty && qty > 0 ? 'secondary' : 'disabled'}
            disabled={!qty || qty <= 0}
          />
        </div>
      </div>
    </>
  );
}

export default BorrowForm;

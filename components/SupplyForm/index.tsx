import { useEffect, useState, useContext } from 'react';
import { ethers } from 'ethers';

import style from './style.module.scss';
import Input from 'components/common/Input';
import Button from 'components/common/Button';
import MaturitySelector from 'components/MaturitySelector';

import useContractWithSigner from 'hooks/useContractWithSigner';
import useContract from 'hooks/useContract';

import daiAbi from 'contracts/abi/dai.json';


import { SupplyRate } from 'types/SupplyRate';
import { Error } from 'types/Error';

import dictionary from 'dictionary/en.json';

import { getUnderlyingAddress } from 'utils/utils';

import { AddressContext } from 'contexts/AddressContext';
import FixedLenderContext from 'contexts/FixedLenderContext';
import InterestRateModelContext from 'contexts/InterestRateModelContext';
import { Dictionary } from 'types/Dictionary';
import { UnderlyingNetwork, Underlying } from 'types/Underlying';
import { Market } from 'types/Market';

type Props = {
  contractWithSigner: ethers.Contract;
  handleResult: (data: SupplyRate | undefined) => void;
  hasRate: boolean;
  address: string;
  assetData: Market | undefined;
};

function SupplyForm({
  contractWithSigner,
  handleResult,
  hasRate,
  address,
  assetData
}: Props) {
  const { date } = useContext(AddressContext);
  const fixedLender = useContext(FixedLenderContext);
  const interestRateModel = useContext(InterestRateModelContext);

  const [qty, setQty] = useState<number>(0);

  const [error, setError] = useState<Error | undefined>({
    status: false,
    msg: ''
  });


  let underlyingAddress: string | undefined = undefined;

  if (assetData?.symbol) {
    underlyingAddress = getUnderlyingAddress(process.env.NEXT_PUBLIC_NETWORK!, assetData.symbol);
  }


  const daiContract = useContractWithSigner(
    underlyingAddress,
    daiAbi
  );


  const interestRateModelContract = useContract(
    interestRateModel.address!,
    interestRateModel.abi!
  );
  const fixedLenderWithSigner = useContractWithSigner(address, fixedLender?.abi!);

  useEffect(() => {
    calculateRate();
  }, [qty, date]);

  async function calculateRate() {
    if (!qty || !date) {
      return setError({ status: true, msg: dictionary.amountError });
    }

    const maturityPools =
      await fixedLenderWithSigner?.contractWithSigner?.maturityPools(
        parseInt(date.value)
      );

    //Supply
    try {
      const supplyRate =
        await interestRateModelContract?.contract?.getRateToSupply(
          parseInt(date.value),
          maturityPools
        );

      const formattedRate = supplyRate && ethers.utils.formatEther(supplyRate);
      formattedRate && handleResult({ potentialRate: formattedRate });
    } catch (e) {
      return setError({ status: true, msg: dictionary.defaultError });
    }
  }

  async function deposit() {
    const provider = new ethers.providers.Web3Provider(window.ethereum, 'any');
    const from = await provider.getSigner().getAddress();

    if (!qty || !date) {
      return setError({ status: true, msg: dictionary.defaultError });
    }

    const approval = await daiContract?.contractWithSigner?.approve(
      address,
      ethers.utils.parseUnits(qty!.toString())
    );

    await approval.wait();

    await fixedLenderWithSigner?.contractWithSigner?.depositToMaturityPool(
      ethers.utils.parseUnits(qty!.toString()),
      parseInt(date.value),
      "0"
    );
  }

  return (
    <>
      <div className={style.fieldContainer}>
        <span>{dictionary.depositTitle}</span>
        <div className={style.inputContainer}>
          <Input
            type="number"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setQty(e.target.valueAsNumber);
              setError({ status: false, msg: '' });
            }}
            value={qty}
          />
        </div>
      </div>
      <div className={style.fieldContainer}>
        <span>{dictionary.endDate}</span>
        <div className={style.inputContainer}>
          <MaturitySelector />
        </div>
      </div>
      {error?.status && <p className={style.error}>{error?.msg}</p>}
      <div className={style.fieldContainer}>
        <div className={style.buttonContainer}>
          <Button
            text={dictionary.deposit}
            onClick={deposit}
            className={qty > 0 ? 'primary' : 'disabled'}
            disabled={qty <= 0}
          />
        </div>
      </div>
    </>
  );
}

export default SupplyForm;

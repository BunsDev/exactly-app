import React, {
  createContext,
  type PropsWithChildren,
  type FC,
  useContext,
  useState,
  useCallback,
  useReducer,
  useMemo,
  useRef,
} from 'react';
import { useSignTypedData, usePublicClient } from 'wagmi';
import { waitForTransaction } from '@wagmi/core';
import {
  formatEther,
  formatUnits,
  Hex,
  parseEther,
  parseUnits,
  pad,
  trim,
  isAddress,
  hexToBigInt,
  keccak256,
  encodeAbiParameters,
} from 'viem';
import { splitSignature } from '@ethersproject/bytes';

import type { ErrorData } from 'types/Error';
import type { Transaction } from 'types/Transaction';
import LeveragerModal from 'components/Leverager/Modal';
import useDebtManager from 'hooks/useDebtManager';
import numbers from 'config/numbers.json';
import useAccountData from 'hooks/useAccountData';
import useMarket from 'hooks/useMarket';
import { useWeb3 } from 'hooks/useWeb3';
import type { DebtManager, Market } from 'types/contracts';
import { GAS_LIMIT_MULTIPLIER, MAX_UINT256, WEI_PER_ETHER } from 'utils/const';
import handleOperationError from 'utils/handleOperationError';
import useIsContract from 'hooks/useIsContract';
import useBalance from 'hooks/useBalance';
import { useTranslation } from 'react-i18next';
import useAssets from 'hooks/useAssets';
import { useTheme } from '@mui/material';
import formatNumber from 'utils/formatNumber';
import useHealthFactor from 'hooks/useHealthFactor';
import parseHealthFactor from 'utils/parseHealthFactor';
import useERC20 from 'hooks/useERC20';
import usePermit2 from 'hooks/usePermit2';
import dayjs from 'dayjs';
import { isPermitAllowed } from 'utils/permit';
import useDebtPreviewer, { Leverage } from 'hooks/useDebtPreviewer';
import useDelayedEffect from 'hooks/useDelayedEffect';

type Input = {
  collateralSymbol?: string;
  borrowSymbol?: string;
  secondaryOperation: 'deposit' | 'withdraw';
  userInput: string;
  leverageRatio: number;
  maxLeverageRatio: number;
  slippage: string;
};

type Value<T> = { display: string; value: T };

type ApprovalStatus = 'INIT' | 'ERC20' | 'ERC20-PERMIT2' | 'MARKET' | 'APPROVED';

const DEFAULT_SLIPPAGE = (numbers.slippage * 100).toFixed(2);

const initState: Input = {
  collateralSymbol: undefined,
  borrowSymbol: undefined,
  secondaryOperation: 'deposit',
  userInput: '',
  leverageRatio: 1,
  maxLeverageRatio: 1,
  slippage: DEFAULT_SLIPPAGE,
};

const reducer = (state: Input, action: Partial<Input>): Input => {
  return { ...state, ...action };
};

type ContextValues = {
  isOpen: boolean;
  openLeverager: (collateralSymbol?: string) => void;
  close: () => void;

  viewSummary: boolean;
  setViewSummary: (state: boolean) => void;
  acceptedTerms: boolean;
  setAcceptedTerms: (state: boolean) => void;

  input: Input;
  setCollateralSymbol: (collateralSymbol: string) => void;
  setBorrowSymbol: (debt: string) => void;
  setSecondaryOperation: (secondaryOperation: 'deposit' | 'withdraw') => void;
  setUserInput: (userInput: string) => void;
  setLeverageRatio: (leverageRatio: number) => void;

  setSlippage: (slippage: string) => void;
  collateralOptions: { symbol: string; value: string }[];
  borrowOptions: { symbol: string; value: string }[];

  currentLeverageRatio: number;
  getCurrentNetPosition: (col: string, bor: string) => bigint | undefined;
  newHealthFactor?: string;
  newCollateral: Value<bigint>;
  newBorrow: Value<bigint>;
  minLeverageRatio: number;
  maxLeverageRatio: number;
  onMax: () => void;
  handleInputChange: (value: string) => void;
  netPosition?: Value<bigint>;
  available?: string;

  loopAPR?: number;
  marketAPR?: number;
  rewardsAPR?: number;
  nativeAPR?: number;

  marketRewards: string[];
  nativeRewards: string[];

  disabledSubmit: boolean;
  disabledConfirm: boolean;

  getHealthFactorColor: (_healthFactor?: string) => { color: string; bg: string };

  debtManager?: DebtManager;
  market?: Market;

  errorData?: ErrorData;
  setErrorData: React.Dispatch<React.SetStateAction<ErrorData | undefined>>;
  tx?: Transaction;

  isLoading: boolean;
  loadingUserInput: boolean;

  needsApproval: () => Promise<boolean>;
  approve: () => Promise<void>;
  submit: () => Promise<void>;
};

const LeveragerContext = createContext<ContextValues | null>(null);

export const LeveragerContextProvider: FC<PropsWithChildren> = ({ children }) => {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const { walletAddress, chain, opts } = useWeb3();
  const healthFactor = useHealthFactor();
  const { getMarketAccount, refreshAccountData } = useAccountData();
  const isContract = useIsContract();
  const { signTypedDataAsync } = useSignTypedData();
  const publicClient = usePublicClient();
  const [isOpen, setIsOpen] = useState(false);
  const [viewSummary, setViewSummary] = useState(false);
  const [errorData, setErrorData] = useState<ErrorData | undefined>();

  const [input, dispatch] = useReducer(reducer, initState);

  const [tx, setTx] = useState<Transaction | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const options = useAssets();

  const ma = useMemo(
    () => getMarketAccount(input.collateralSymbol ?? 'USDC'),
    [getMarketAccount, input.collateralSymbol],
  );

  const market = useMarket(ma?.market);
  const asset = useERC20(ma?.asset);
  const debtManager = useDebtManager();
  const debtPreviewer = useDebtPreviewer();
  const permit2 = usePermit2();

  const [leveragePreview, setLeveragePreview] = useState<Leverage>();

  const minLeverageRatio = 1;

  const currentLeverageRatio = leveragePreview ? Number(leveragePreview.ratio) / 1e18 : minLeverageRatio;

  const setLeverageRatio = useCallback(
    (leverageRatio: number) => {
      const _secondaryOperation = leverageRatio < currentLeverageRatio ? 'withdraw' : 'deposit';
      const changedOperation = _secondaryOperation !== input.secondaryOperation;
      setErrorData(undefined);

      dispatch({
        leverageRatio,
        secondaryOperation: _secondaryOperation,
        userInput: changedOperation ? '' : input.userInput,
      });
    },
    [input.secondaryOperation, input.userInput, currentLeverageRatio],
  );

  const setMaxLeverageRatio = useCallback((maxLeverageRatio: number) => {
    dispatch({
      maxLeverageRatio,
    });
  }, []);

  const previewLeverage = useCallback(
    async (cancelled: () => boolean, borrowSymbol: string | undefined = input.borrowSymbol) => {
      if (!debtPreviewer || !walletAddress || !input.collateralSymbol || !borrowSymbol || !opts) {
        setLeveragePreview(undefined);
        return undefined;
      }

      const collateralMarket = getMarketAccount(input.collateralSymbol);
      const borrowMarket = getMarketAccount(borrowSymbol);
      if (!collateralMarket || !borrowMarket) {
        setLeveragePreview(undefined);
        return undefined;
      }

      const { result } = await debtPreviewer.simulate.leverage(
        [collateralMarket.market, borrowMarket.market, walletAddress],
        opts,
      );

      if (cancelled()) return undefined;

      setLeveragePreview(result);
      return result;
    },
    [debtPreviewer, getMarketAccount, input.borrowSymbol, input.collateralSymbol, opts, walletAddress],
  );

  const { isLoading: previewIsLoading } = useDelayedEffect({
    effect: useCallback(
      async (cancelled: () => boolean) => {
        await previewLeverage(cancelled);
      },
      [previewLeverage],
    ),
  });

  const walletBalance = useBalance(input.collateralSymbol, ma?.asset);

  const [collateralOptions, borrowOptions] = useMemo(
    () => [
      options.flatMap((symbol) => {
        const marketAccount = getMarketAccount(symbol);
        if (!marketAccount) return [];
        const { floatingDepositAssets, usdPrice, decimals } = marketAccount;
        return [
          {
            symbol,
            value: '$' + formatNumber(formatEther((floatingDepositAssets * usdPrice) / 10n ** BigInt(decimals)), 'USD'),
          },
        ];
      }),
      options.flatMap((symbol) => {
        const marketAccount = getMarketAccount(symbol);
        if (!marketAccount) return [];
        const { floatingBorrowAssets, usdPrice, decimals } = marketAccount;
        return [
          {
            symbol,
            value: '$' + formatNumber(formatEther((floatingBorrowAssets * usdPrice) / 10n ** BigInt(decimals)), 'USD'),
          },
        ];
      }),
    ],
    [options, getMarketAccount],
  );

  const _userInput = useMemo(() => {
    if (!input.collateralSymbol) return 0n;
    const marketAccount = getMarketAccount(input.collateralSymbol);
    if (!marketAccount) return 0n;
    return parseUnits(input.userInput, marketAccount.decimals);
  }, [getMarketAccount, input.collateralSymbol, input.userInput]);

  const previewDeposit = useCallback(
    async (cancelled: () => boolean) => {
      if (!debtPreviewer || !walletAddress || !input.collateralSymbol || !input.collateralSymbol || !opts) return;

      const collateralMarket = getMarketAccount(input.collateralSymbol);
      const borrowMarket = getMarketAccount(input.collateralSymbol);
      if (!collateralMarket || !borrowMarket) return;

      const newMaxLeverageRatio = await debtPreviewer.read.previewDeposit(
        [collateralMarket.market, borrowMarket.market, walletAddress, _userInput],
        opts,
      );

      if (cancelled()) return;

      setMaxLeverageRatio(Number(newMaxLeverageRatio) / 1e18);
    },
    [_userInput, debtPreviewer, getMarketAccount, input.collateralSymbol, opts, setMaxLeverageRatio, walletAddress],
  );

  const { isLoading: previewDepositIsLoading } = useDelayedEffect({
    effect: useCallback(async (cancelled: () => boolean) => await previewDeposit(cancelled), [previewDeposit]),
    skip: errorData?.status || previewIsLoading,
  });

  const getCurrentNetPosition = useCallback(() => {
    if (!leveragePreview) return undefined;
    return leveragePreview.principal + (input.secondaryOperation === 'deposit' ? _userInput : 0n);
  }, [_userInput, input.secondaryOperation, leveragePreview]);

  const [netPosition, netPositionUSD] = useMemo(() => {
    if (!input.collateralSymbol || !input.borrowSymbol) return [undefined, undefined];

    const collateralMarket = getMarketAccount(input.collateralSymbol);

    const assets = getCurrentNetPosition();
    if (!collateralMarket || assets === undefined) return [undefined, undefined];
    const usd = (assets * collateralMarket.usdPrice) / 10n ** BigInt(collateralMarket.decimals);
    return [
      {
        display: formatUnits(assets, collateralMarket.decimals),
        value: assets,
      },
      usd,
    ];
  }, [getCurrentNetPosition, getMarketAccount, input.borrowSymbol, input.collateralSymbol]);

  const [newCollateral, newCollateralUSD] = useMemo(() => {
    if (!netPositionUSD || !input.collateralSymbol) return [{ display: '0', value: 0n }, 0n];
    const collateralMarket = getMarketAccount(input.collateralSymbol);
    if (!collateralMarket) return [{ display: '0', value: 0n }, 0n];

    const _currentLeverageRatio = parseEther(input.leverageRatio.toString());
    const resultUSD = (netPositionUSD * _currentLeverageRatio) / WEI_PER_ETHER;
    const resultAssets = (resultUSD * 10n ** BigInt(collateralMarket.decimals)) / collateralMarket.usdPrice;
    return [
      {
        display: formatUnits(resultAssets, collateralMarket.decimals),
        value: resultAssets,
      },
      resultUSD,
    ];
  }, [getMarketAccount, input.collateralSymbol, input.leverageRatio, netPositionUSD]);

  const [newBorrow, newBorrowUSD] = useMemo(() => {
    if (!netPositionUSD || !input.borrowSymbol) return [{ display: '0', value: 0n }, 0n];
    const borrowMarket = getMarketAccount(input.borrowSymbol);
    if (!borrowMarket) return [{ display: '0', value: 0n }, 0n];

    const _currentLeverageRatio = parseEther(input.leverageRatio.toString());

    let positionUSD = netPositionUSD;
    if (input.secondaryOperation === 'withdraw') {
      const withdraw = parseUnits(input.userInput, borrowMarket.decimals);
      const withdrawUSD = (withdraw * borrowMarket.usdPrice) / 10n ** BigInt(borrowMarket.decimals);
      positionUSD -= withdrawUSD;
    }

    const resultUSD = (positionUSD * (_currentLeverageRatio - WEI_PER_ETHER)) / WEI_PER_ETHER;
    const resultAssets = (resultUSD * 10n ** BigInt(borrowMarket.decimals)) / borrowMarket.usdPrice;
    return [
      {
        display: formatUnits(resultAssets, borrowMarket.decimals),
        value: resultAssets,
      },
      resultUSD,
    ];
  }, [
    getMarketAccount,
    input.borrowSymbol,
    input.leverageRatio,
    input.secondaryOperation,
    input.userInput,
    netPositionUSD,
  ]);

  const newHealthFactor = useMemo(() => {
    if (!healthFactor || !input.collateralSymbol || !input.borrowSymbol || !leveragePreview) return undefined;

    const collateralMarket = getMarketAccount(input.collateralSymbol);
    const borrowMarket = getMarketAccount(input.borrowSymbol);
    if (!collateralMarket || !borrowMarket) return undefined;

    const depositsUSD =
      ((newCollateral.value - leveragePreview.collateral) * collateralMarket.usdPrice) /
      10n ** BigInt(collateralMarket.decimals);

    const borrowsUSD =
      ((newBorrow.value - leveragePreview.debt) * borrowMarket.usdPrice) / 10n ** BigInt(borrowMarket.decimals);

    const collateral = (depositsUSD * collateralMarket.adjustFactor) / WEI_PER_ETHER;
    const debt = (borrowsUSD * WEI_PER_ETHER) / borrowMarket.adjustFactor;

    return parseHealthFactor(healthFactor.debt + debt, healthFactor.collateral + collateral);
  }, [
    getMarketAccount,
    healthFactor,
    input.borrowSymbol,
    input.collateralSymbol,
    leveragePreview,
    newBorrow.value,
    newCollateral.value,
  ]);

  const setCollateralSymbol = useCallback((collateralSymbol: string) => {
    setErrorData(undefined);
    dispatch({ ...initState, collateralSymbol });
  }, []);
  const setBorrowSymbol = useCallback(
    async (borrowSymbol: string) => {
      if (!input.collateralSymbol) return;
      setErrorData(undefined);
      const res = await previewLeverage(() => false, borrowSymbol);
      dispatch({
        ...initState,
        collateralSymbol: input.collateralSymbol,
        borrowSymbol: borrowSymbol,
        leverageRatio: res ? Number(res.ratio) / 1e18 : minLeverageRatio,
        maxLeverageRatio: res ? Number(res.maxRatio) / 1e18 : minLeverageRatio,
      });
    },
    [input.collateralSymbol, previewLeverage],
  );
  const setSecondaryOperation = useCallback((secondaryOperation: 'deposit' | 'withdraw') => {
    setErrorData(undefined);
    dispatch({ secondaryOperation, userInput: '' });
  }, []);
  const setUserInput = useCallback((userInput: string) => {
    setErrorData(undefined);
    dispatch({ userInput });
  }, []);
  const setSlippage = useCallback((slippage: string) => dispatch({ slippage }), []);

  const close = useCallback(() => setIsOpen(false), []);

  const _setViewSummary = useCallback((_state: boolean) => {
    setAcceptedTerms(false);
    setViewSummary(_state);
  }, []);

  const openLeverager = useCallback(
    (collateralSymbol?: string) => {
      dispatch({ ...initState, collateralSymbol });
      _setViewSummary(false);
      setTx(undefined);
      setIsLoading(false);
      setIsOpen(true);
    },
    [_setViewSummary],
  );

  // TODO: this should be computed by the backend as it should consider fees from the swap
  const onMax = useCallback(() => {
    setErrorData(undefined);
    if (input.secondaryOperation === 'deposit') {
      if (walletBalance) {
        return setUserInput(walletBalance);
      }
    }
    setUserInput(formatUnits(leveragePreview?.maxWithdraw ?? 0n, ma?.decimals ?? 18));
  }, [input.secondaryOperation, leveragePreview?.maxWithdraw, ma?.decimals, setUserInput, walletBalance]);

  // TODO: For errors we should use the data from previews to consider fees from the swap
  const handleInputChange = useCallback(
    (value: string) => {
      setUserInput(value);

      const parsed = parseUnits(value, ma?.decimals ?? 18);

      if (input.secondaryOperation === 'deposit') {
        if (walletBalance && parseFloat(value) > parseFloat(walletBalance)) {
          return setErrorData({ status: true, message: t('Insufficient balance') });
        }
      } else {
        if (netPosition && parsed > netPosition.value) {
          return setErrorData({ status: true, message: t('Insufficient funds') });
        }
      }

      dispatch({
        leverageRatio: Math.min(
          !value && leveragePreview ? Number(leveragePreview.maxRatio) / 1e18 : input.maxLeverageRatio,
          input.leverageRatio,
        ),
      });
      setErrorData(undefined);
    },
    [
      setUserInput,
      ma?.decimals,
      input.secondaryOperation,
      input.leverageRatio,
      input.maxLeverageRatio,
      leveragePreview,
      walletBalance,
      t,
      netPosition,
    ],
  );

  const available = useMemo(() => {
    if (input.secondaryOperation === 'deposit') {
      return walletBalance;
    }

    return formatNumber(netPosition?.display ?? '0', input?.collateralSymbol);
  }, [input.secondaryOperation, input?.collateralSymbol, netPosition?.display, walletBalance]);

  //TODO: calculate CONTINUE
  const [loopAPR, marketAPR, rewardsAPR, nativeAPR] = useMemo(() => {
    return [0.137, 0.074, 0.021, 0];
  }, []);

  // TODO: calculate
  const marketRewards = useMemo(() => ['OP', 'USDC'], []);

  // TODO: calculate
  const nativeRewards = useMemo(() => ['WBTC'], []);

  const disabledSubmit = useMemo(
    () =>
      !input.collateralSymbol ||
      !input.borrowSymbol ||
      errorData?.status ||
      netPositionUSD === undefined ||
      netPositionUSD === 0n ||
      (currentLeverageRatio === input.leverageRatio && !input.userInput) ||
      (getCurrentNetPosition() ?? -1n) < 0n,
    [
      input.collateralSymbol,
      input.borrowSymbol,
      input.leverageRatio,
      input.userInput,
      errorData?.status,
      netPositionUSD,
      currentLeverageRatio,
      getCurrentNetPosition,
    ],
  );

  const disabledConfirm = useMemo(() => disabledSubmit || !acceptedTerms, [acceptedTerms, disabledSubmit]);

  const getHealthFactorColor = useCallback(
    (_healthFactor?: string) => {
      if (!_healthFactor) return { color: palette.healthFactor.safe, bg: palette.healthFactor.bg.safe };
      const parsedHF = parseFloat(_healthFactor);
      const status = parsedHF < 1.01 ? 'danger' : parsedHF < 1.05 ? 'warning' : 'safe';
      return { color: palette.healthFactor[status], bg: palette.healthFactor.bg[status] };
    },
    [palette.healthFactor],
  );

  const approvalStatus = useRef<ApprovalStatus>('INIT');
  const needsApproval = useCallback(async (): Promise<boolean> => {
    if (
      !ma ||
      !input.collateralSymbol ||
      !input.borrowSymbol ||
      !walletAddress ||
      !market ||
      !asset ||
      !permit2 ||
      !debtManager ||
      !opts
    ) {
      return true;
    }

    const borrowAssets = newBorrow.value;
    const deposit = parseUnits(input.userInput, ma.decimals);
    setIsLoading(true);
    approvalStatus.current = 'INIT';
    try {
      if (await isContract(walletAddress)) {
        if (input.secondaryOperation === 'deposit') {
          approvalStatus.current = 'ERC20';
          const assetAllowance = await asset.read.allowance([walletAddress, debtManager.address], opts);
          if (assetAllowance <= deposit) return true;
        }

        approvalStatus.current = 'MARKET';
        const marketAllownce = await market.read.allowance([walletAddress, debtManager.address], opts);
        if (marketAllownce <= borrowAssets) return true;

        approvalStatus.current = 'APPROVED';
        return false;
      }

      if (!isPermitAllowed(chain, ma.assetSymbol) && input.secondaryOperation === 'deposit') {
        approvalStatus.current = 'ERC20-PERMIT2';
        const allowance = await asset.read.allowance([walletAddress, permit2.address], opts);
        if (allowance <= deposit) return true;
      }

      approvalStatus.current = 'APPROVED';
      return false;
    } catch (e: unknown) {
      setErrorData({ status: true, message: handleOperationError(e) });
      return true;
    } finally {
      setIsLoading(false);
    }
  }, [
    ma,
    newBorrow.value,
    input.userInput,
    input.collateralSymbol,
    input.borrowSymbol,
    input.secondaryOperation,
    walletAddress,
    market,
    asset,
    permit2,
    debtManager,
    opts,
    isContract,
    chain,
  ]);

  const approve = useCallback(async () => {
    if (!debtManager || !market || !asset || !permit2 || !opts) return;

    const max = MAX_UINT256;
    setIsLoading(true);
    try {
      // TODO: Define max assets to approve (Uint256)
      // Deposit for both ERC20, and newBorrow.value (for leverage) and floatingBorrowAssets - newBorrow (-withdraw?) for deleverage
      const args = [debtManager.address, max] as const;
      let hash: Hex | undefined;
      switch (approvalStatus.current) {
        case 'ERC20': {
          const gasEstimation = await asset.estimateGas.approve(args, opts);
          hash = await asset.write.approve(args, {
            ...opts,
            gasLimit: (gasEstimation * GAS_LIMIT_MULTIPLIER) / WEI_PER_ETHER,
          });
          break;
        }
        case 'ERC20-PERMIT2': {
          const approvePermit2 = [permit2.address, max] as const;
          const gasEstimation = await asset.estimateGas.approve(approvePermit2, opts);
          hash = await asset.write.approve(approvePermit2, {
            ...opts,
            gasLimit: (gasEstimation * GAS_LIMIT_MULTIPLIER) / WEI_PER_ETHER,
          });
          break;
        }
        case 'MARKET': {
          const gasEstimation = await market.estimateGas.approve(args, opts);
          hash = await market.write.approve(args, {
            ...opts,
            gasLimit: (gasEstimation * GAS_LIMIT_MULTIPLIER) / WEI_PER_ETHER,
          });
          break;
        }
        default:
          return;
      }

      if (!hash) return;
      await waitForTransaction({ hash });
    } catch (e: unknown) {
      setErrorData({ status: true, message: handleOperationError(e) });
    } finally {
      setIsLoading(false);
    }
  }, [asset, debtManager, market, opts, permit2]);

  const signPermit = useCallback(
    async (value: bigint, verifier: 'asset' | 'market') => {
      if (!walletAddress || !ma || !market || !permit2 || !asset || !debtManager) return;

      const deadline = BigInt(dayjs().unix() + 3_600);

      if (verifier === 'asset' && !isPermitAllowed(chain, ma.assetSymbol)) {
        const signature = await signTypedDataAsync({
          primaryType: 'PermitTransferFrom',
          domain: {
            name: 'Permit2',
            chainId: chain.id,
            verifyingContract: permit2.address,
          },
          types: {
            PermitTransferFrom: [
              { name: 'permitted', type: 'TokenPermissions' },
              { name: 'spender', type: 'address' },
              { name: 'nonce', type: 'uint256' },
              { name: 'deadline', type: 'uint256' },
            ],
            TokenPermissions: [
              { name: 'token', type: 'address' },
              { name: 'amount', type: 'uint256' },
            ],
          },
          message: {
            permitted: {
              token: asset.address,
              amount: value,
            },
            spender: debtManager.address,
            deadline,
            nonce: hexToBigInt(
              keccak256(
                encodeAbiParameters(
                  [
                    { name: 'sender', type: 'address' },
                    { name: 'token', type: 'address' },
                    { name: 'assets', type: 'uint256' },
                    { name: 'deadline', type: 'uint256' },
                  ],
                  [walletAddress, asset.address, value, deadline],
                ),
              ),
            ),
          },
        });

        const permit = {
          deadline,
          signature,
        } as const;

        return { type: 'permit2', value: permit } as const;
      }

      const [impl, nonce] = await Promise.all([
        verifier === 'market'
          ? publicClient.getStorageAt({
              address: market.address,
              slot: '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc',
            })
          : asset.address,
        verifier === 'market' ? market.read.nonces([walletAddress], opts) : asset.read.nonces([walletAddress], opts),
      ]);

      if (!impl) return;
      const verifyingContract = pad(trim(impl), { size: 20 });
      if (!isAddress(verifyingContract)) return;

      const { v, r, s } = await signTypedDataAsync({
        primaryType: 'Permit',
        domain: {
          name: verifier === 'market' ? '' : ma.assetSymbol,
          version: '1',
          chainId: chain.id,
          verifyingContract,
        },
        types: {
          Permit: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'nonce', type: 'uint256' },
            { name: 'deadline', type: 'uint256' },
          ],
        },
        message: {
          owner: walletAddress,
          spender: debtManager.address,
          value,
          nonce,
          deadline,
        },
      }).then(splitSignature);

      const permit = {
        account: walletAddress,
        deadline,
        ...{ v, r: r as Hex, s: s as Hex },
      } as const;

      return { type: 'permit', value: permit } as const;
    },
    [asset, chain, debtManager, ma, market, opts, permit2, publicClient, signTypedDataAsync, walletAddress],
  );

  const submit = useCallback(async () => {
    if (
      !walletAddress ||
      !input.collateralSymbol ||
      !input.borrowSymbol ||
      !debtManager ||
      !market ||
      !asset ||
      !ma ||
      !opts
    )
      return;

    setIsLoading(true);
    try {
      // leverageRatio could be higher than maxLeverageRatio if the user has changed the input
      const ratio = parseEther(String(Math.min(input.leverageRatio, input.maxLeverageRatio)));

      let hash: Hex | undefined;
      if (await isContract(walletAddress)) {
        if (input.collateralSymbol === input.borrowSymbol) {
          switch (input.secondaryOperation) {
            case 'deposit': {
              const args = [market.address, _userInput, ratio] as const;
              const gasEstimation = await debtManager.estimateGas.leverage(args, opts);
              hash = await debtManager.write.leverage(args, {
                ...opts,
                gasLimit: (gasEstimation * GAS_LIMIT_MULTIPLIER) / WEI_PER_ETHER,
              });
              break;
            }
            case 'withdraw': {
              const args = [market.address, ratio, _userInput] as const;
              const gasEstimation = await debtManager.estimateGas.deleverage(args, opts);
              hash = await debtManager.write.deleverage(args, {
                ...opts,
                gasLimit: (gasEstimation * GAS_LIMIT_MULTIPLIER) / WEI_PER_ETHER,
              });
              break;
            }
          }
        } else {
          // TODO: cross
        }
      } else {
        if (input.collateralSymbol === input.borrowSymbol) {
          switch (input.secondaryOperation) {
            case 'deposit': {
              const borrowAssets = newBorrow.value;
              const assetPermit = await signPermit(_userInput, 'asset');
              const marketPermit = await signPermit(borrowAssets, 'market');
              if (!assetPermit || !marketPermit || marketPermit.type === 'permit2') return;
              const args = [market.address, _userInput, ratio, borrowAssets, marketPermit.value] as const;
              switch (assetPermit.type) {
                case 'permit': {
                  const leverageArgs = [...args, assetPermit.value] as const;
                  const gasEstimation = await debtManager.estimateGas.leverage(leverageArgs, opts);
                  hash = await debtManager.write.leverage(leverageArgs, {
                    ...opts,
                    gasLimit: (gasEstimation * GAS_LIMIT_MULTIPLIER) / WEI_PER_ETHER,
                  });
                  break;
                }
                case 'permit2': {
                  const leverageArgs = [...args, assetPermit.value] as const;
                  const gasEstimation = await debtManager.estimateGas.leverage(leverageArgs, opts);
                  hash = await debtManager.write.leverage(leverageArgs, {
                    ...opts,
                    gasLimit: (gasEstimation * GAS_LIMIT_MULTIPLIER) / WEI_PER_ETHER,
                  });
                  break;
                }
              }
              break;
            }
            case 'withdraw': {
              const permitAssets =
                (ma.floatingBorrowAssets < newBorrow.value ? 0n : ma.floatingBorrowAssets - newBorrow.value) +
                _userInput;
              const marketPermit = await signPermit(permitAssets, 'market');
              if (!marketPermit || marketPermit.type === 'permit2') return;
              const args = [market.address, ratio, _userInput, permitAssets, marketPermit.value] as const;
              const gasEstimation = await debtManager.estimateGas.deleverage(args, opts);
              hash = await debtManager.write.deleverage(args, {
                ...opts,
                gasLimit: (gasEstimation * GAS_LIMIT_MULTIPLIER) / WEI_PER_ETHER,
              });
              break;
            }
          }
        } else {
          // TODO: cross
        }
      }

      if (!hash) return;

      await waitForTransaction({ hash });
      await refreshAccountData();
    } catch (e: unknown) {
      setErrorData({ status: true, message: handleOperationError(e) });
    } finally {
      setIsLoading(false);
    }
  }, [
    walletAddress,
    input.collateralSymbol,
    input.borrowSymbol,
    input.leverageRatio,
    input.maxLeverageRatio,
    input.secondaryOperation,
    debtManager,
    market,
    asset,
    ma,
    opts,
    isContract,
    refreshAccountData,
    _userInput,
    newBorrow.value,
    signPermit,
  ]);

  const value: ContextValues = {
    isOpen,
    openLeverager,
    close,

    viewSummary,
    setViewSummary: _setViewSummary,
    acceptedTerms,
    setAcceptedTerms,

    input,
    setCollateralSymbol,
    setBorrowSymbol,
    setSecondaryOperation,
    setUserInput,
    setLeverageRatio,
    setSlippage,

    collateralOptions,
    borrowOptions,

    currentLeverageRatio,
    getCurrentNetPosition,
    newHealthFactor,
    newCollateral,
    newBorrow,
    minLeverageRatio,
    maxLeverageRatio: input.maxLeverageRatio,
    onMax,
    handleInputChange,
    netPosition,
    available,

    loopAPR,
    marketAPR,
    rewardsAPR,
    nativeAPR,

    marketRewards,
    nativeRewards,

    debtManager,
    market,

    disabledSubmit,
    disabledConfirm,

    getHealthFactorColor,

    errorData,
    setErrorData,
    tx,
    isLoading: isLoading || previewIsLoading,
    loadingUserInput: previewDepositIsLoading,

    needsApproval,
    approve,
    submit,
  };

  return (
    <LeveragerContext.Provider value={value}>
      {children}
      <LeveragerModal />
    </LeveragerContext.Provider>
  );
};

export function useLeveragerContext() {
  const ctx = useContext(LeveragerContext);
  if (!ctx) {
    throw new Error('Using LeveragerContext outside of provider');
  }
  return ctx;
}

export default LeveragerContext;

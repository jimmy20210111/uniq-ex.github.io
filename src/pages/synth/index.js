import { client } from '@ont-dev/ontology-dapi'
import React, { useState, useEffect, useCallback } from 'react'
import { utils } from 'ontology-ts-sdk'
import BigNumber from 'bignumber.js'
import { useAlert } from 'react-alert'
import { useMappedState, useDispatch } from 'redux-react-hook'
import TokenInput from '../../components/tokenInput';
import Input from '../../components/input'
import { DAI_PRICE, SYNTH_PRICE_DECIMALS, ASSET_STATUS, LEVERAGE_TYPE } from '../../utils/constants'
import { TRANSACTION_BASE_URL, TRANSACTION_AFTERFIX } from '../../config'
import { useFetchPairs } from '../../hooks/usePair'
import './index.css'

const { StringReader, reverseHex } = utils

const Synth = () => {
  const [synthType, setSynthType] = useState('mint')
  const [mintAsset, setMintAsset] = useState({})
  const [mintAmount, setMintAmount] = useState('')
  const [unxNeededForMint, setUnxNeededForMint] = useState('')
  const [burnAsset, setBurnAsset] = useState({})
  const [burnAmount, setBurnAmount] = useState('')
  const [unxGetForBurn, setUnxGetForBurn] = useState('')
  const [exchangeAsset, setExchangeAsset] = useState({})
  const [exchangeToAsset, setExchangeToAsset] = useState({})
  const [exchangeAmount, setExchangeAmount] = useState('')
  const [exchangeToAssets, setExchangeToAssets] = useState([])
  const [exchangeToAmount, setExchangeToAmount] = useState('')
  const [unxToken, setUnxToken] = useState({})
  const [unxPrice, setUnxPrice] = useState(0)
  const [roi, setRoi] = useState(0)
  const [allAssetValue, setAllAssetValue] = useState(0)
  const [showMintModal, setShowMintModal] = useState(false)
  const [showBurnModal, setShowBurnModal] = useState(false)
  const [showExchangeModal, setShowExchangeModal] = useState(false)
  const [availableReward, setAvailableReward] = useState('-')
  const [marketStat, setMarketStat] = useState({})
  const [stat, setStat] = useState({})
  const { account, tokens, pairs, SYNTH_ADDRESS } = useMappedState((state) => ({
    account: state.wallet.account,
    tokens: state.common.tokens,
    pairs: state.swap.pairs,
    SYNTH_ADDRESS: state.gov.poolStat.pools.synth.address
  }))
  const dispatch = useDispatch()
  const setModal = useCallback((modalType, modalDetail) => dispatch({ type: 'SET_MODAL', modalType, modalDetail }), [])
  const setStopInterval = useCallback((stopInterval) => dispatch({ type: 'SET_STOP_INTERVAL', stopInterval }), [])

  const Alert = useAlert()

  useFetchPairs()

  useEffect(() => {
    if (tokens.length) {
      setUnxToken(tokens.find((t) => t.name === 'UNX'))
    }
  }, [tokens])

  useEffect(() => {
    if (tokens.length && pairs.length && !unxPrice) {
      const unxTk = tokens.find((t) => t.name === 'UNX')
      const daiTk = tokens.find((t) => t.name === 'pDAI')
      const pair = pairs.find((p) => (p.token1 === unxTk.id && p.token2 === daiTk.id) || (p.token2 === unxTk.id && p.token1 === daiTk.id))

      if (pair) {
        if (pair.token1 === unxTk.id) {
          setUnxPrice((pair.reserve2 / (10 ** daiTk.decimals)) / (pair.reserve1 / (10 ** unxTk.decimals)) * DAI_PRICE)
        } else {
          setUnxPrice((pair.reserve1 / (10 ** daiTk.decimals)) / (pair.reserve2 / (10 ** unxTk.decimals)) * DAI_PRICE)
        }
      }

      setUnxToken(unxTk)
    }
  }, [pairs, tokens])

  useEffect(() => {
    if (marketStat.accountStakeValue) {
      const claimed = marketStat.accountClaimedValue
      const reward = availableReward * (10 ** unxToken.decimals)
      const transferable = marketStat.accountStakeValue / marketStat.marketStakeValue * marketStat.marketTokenBalance
      const minted = marketStat.accountStakeValue
      const withdrawed = marketStat.accountWithdrawedStakeValue
      setRoi(((claimed + reward + transferable - minted - withdrawed) / minted * 100).toFixed(2))
    }
  }, [marketStat, availableReward, unxToken])

  useEffect(() => {
    function getAvailableReward() {
      if (account && unxToken.id && SYNTH_ADDRESS) {
        try {
          client.api.smartContract.invokeWasmRead({
            scriptHash: SYNTH_ADDRESS,
            operation: 'claim_unx',
            args: [
              {
                type: 'Long',
                value: unxToken.id
              },
              {
                type: 'Address',
                value: account
              }
            ]
          })
          .then((claimStr) => {
            const strReader = new StringReader(claimStr)
            const availableReward = strReader.readUint128()

            setAvailableReward(availableReward / (10 ** unxToken.decimals))
          })
          .catch((e) => {
            console.log('get market stat', e)
          })
        } catch (e) {
          console.log(e)
        }
      }
    }

    getAvailableReward()
    const interval = setInterval(getAvailableReward, 10000)
    return () => {
      interval && clearInterval(interval)
    }
  }, [account, unxToken, SYNTH_ADDRESS])

  useEffect(() => {
    function getStat() {
      if (tokens.length && SYNTH_ADDRESS) {
        try {
          client.api.smartContract.invokeWasmRead({
            scriptHash: SYNTH_ADDRESS,
            operation: 'stat',
            args: []
          }).then((statStr) => {
            const strReader = new StringReader(statStr)
    
            reverseHex(strReader.read(20)) // govAddress
            strReader.readUint128() // daiTokenId
            strReader.readUint128() // unxTokenId
            strReader.readUint128() // pairId

            const liveAssetCount = strReader.readNextLen()
            const liveAssets = []
            for (let i = 0; i < liveAssetCount; i++) {
              const asset = {}
              asset.assetId = strReader.readUint128()
              asset.tokenId = strReader.readUint128()

              const token = tokens.find((t) => t.id === asset.tokenId)
              asset.tokenName = token.name
              asset.decimals = token.decimals
              asset.leverageType = strReader.readNextByte()
              asset.times = strReader.readUint128()
              asset.entryPrice = strReader.readUint128()
              asset.lowLimit = strReader.readUint128()
              asset.highLimit = strReader.readUint128()
              asset.status = strReader.readNextByte()
              asset.frozenBy = reverseHex(strReader.read(20))
              asset.frozenTime = strReader.readUint64()
    
              asset.id = asset.assetId
              asset.value = asset.assetId
              asset.label = asset.tokenName
              liveAssets.push(asset)
            }

            const frozenAssetCount = strReader.readNextLen()
            const frozenAssets = []
            for (let i = 0; i < frozenAssetCount; i++) {
              const asset = {}
              asset.assetId = strReader.readUint128()
              asset.tokenId = strReader.readUint128()
              asset.leverageType = strReader.readNextByte()
              asset.times = strReader.readUint128()
              asset.entryPrice = strReader.readUint128()
              asset.lowLimit = strReader.readUint128()
              asset.highLimit = strReader.readUint128()
              asset.status = strReader.readNextByte()
              asset.frozenBy = reverseHex(strReader.read(20))
              asset.frozenTime = strReader.readUint64()
    
              frozenAssets.push(asset)
            }

            const tokenPriceCount = strReader.readNextLen()
            const tokenPrices = []
            for (let i = 0; i < tokenPriceCount; i++) {
              const tokenPrice = {}
              tokenPrice.tokenId = strReader.readUint128()
              tokenPrice.price = strReader.readUint128()
    
              tokenPrices.push(tokenPrice)
            }

            for (let liveAsset of liveAssets) {
              let tokenPrice = 0
              switch (liveAsset.status) {
                case ASSET_STATUS.Live:
                  tokenPrice = tokenPrices.find((tp) => tp.tokenId === liveAsset.tokenId).price
                  break
                case ASSET_STATUS.HighLimit:
                  tokenPrice = liveAsset.highLimit
                  break
                case ASSET_STATUS.LowLimit:
                  tokenPrice = liveAsset.lowLimit
                  break
                default:
                  break
              }

              if (liveAsset.leverageType === LEVERAGE_TYPE.Positive) {
                liveAsset.price = liveAsset.entryPrice + tokenPrice * liveAsset.times - liveAsset.entryPrice * liveAsset.times
              } else {
                liveAsset.price = liveAsset.entryPrice + liveAsset.entryPrice * liveAsset.times - tokenPrice * liveAsset.times
              }
            }

            setStat({
              liveAssets,
              frozenAssets,
              tokenPrices
            })
          }).catch((e) => {
            console.log('get synth stat', e)
          })
        } catch (e) {
          console.log('get synth stat', e)
        }
      }
    }

    getStat()
    const interval = setInterval(getStat, 5000)

    return () => clearInterval(interval)
  }, [tokens, SYNTH_ADDRESS])

  useEffect(() => {
    function getMarketStat() {
      if (account && unxToken.id && SYNTH_ADDRESS) {
        try {
          client.api.smartContract.invokeWasmRead({
            scriptHash: SYNTH_ADDRESS,
            operation: 'market_stat',
            args: [
              {
                type: 'Long',
                value: unxToken.id
              },
              {
                type: 'Address',
                value: account
              }
            ]
          })
          .then((statStr) => {
            const strReader = new StringReader(statStr)

            const marketAssetBalanceCount = strReader.readNextLen()
            const marketAssetBalances = []
            for (let i = 0; i < marketAssetBalanceCount; i++) {
              const assetBalance = {}
              assetBalance.assetId = strReader.readUint128()
              assetBalance.balance = strReader.readUint128()
              assetBalance.assetPrice = strReader.readUint128()
    
              marketAssetBalances.push(assetBalance)
            }

            const accountAssetBalanceCount = strReader.readNextLen()
            const accountAssetBalances = []
            let assetValueSum = 0
            for (let i = 0; i < accountAssetBalanceCount; i++) {
              const assetBalance = {}
              assetBalance.assetId = strReader.readUint128()
              assetBalance.balance = strReader.readUint128()
              assetBalance.assetPrice = strReader.readUint128()

              const asset = stat.liveAssets ? stat.liveAssets.find((la) => la.assetId === assetBalance.assetId) : null

              if (asset) {
                assetValueSum += assetBalance.assetPrice / SYNTH_PRICE_DECIMALS * assetBalance.balance / (10 ** asset.decimals)
              }
    
              accountAssetBalances.push(assetBalance)
            }

            const marketStakeValue = strReader.readUint128()
            const accountStakeValue = strReader.readUint128()
            const marketTokenBalance = strReader.readUint128()
            const accountClaimedValue = strReader.readUint128()
            const accountWithdrawedStakeValue = strReader.readUint128()

            const parsedMarketStat = {
              marketAssetBalances,
              accountAssetBalances,
              marketStakeValue,
              accountStakeValue,
              marketTokenBalance,
              accountClaimedValue,
              accountWithdrawedStakeValue
            }

            setAllAssetValue(assetValueSum)
            setMarketStat(parsedMarketStat)
          })
          .catch((e) => {
            console.log('get market stat', e)
          })
        } catch (e) {
          console.log(e)
        }
      }
    }

    getMarketStat()
    const interval = setInterval(getMarketStat, 5000)
    return () => {
      interval && clearInterval(interval)
    }
  }, [account, unxToken, stat.liveAssets, SYNTH_ADDRESS])

  useEffect(() => {
    if (unxPrice && mintAmount) {
      setUnxNeededForMint(mintAmount * mintAsset.price / SYNTH_PRICE_DECIMALS / unxPrice)
    }
  }, [mintAmount, mintAsset])

  useEffect(() => {
    if (unxPrice && burnAmount) {
      setUnxGetForBurn(burnAmount * burnAsset.assetPrice / SYNTH_PRICE_DECIMALS / unxPrice)
    }
  }, [burnAmount, burnAsset])

  useEffect(() => {
    if (exchangeAmount) {
      setExchangeToAmount(exchangeAsset.price / exchangeToAsset.price * exchangeAmount * (10 ** exchangeAsset.decimals) / (10 ** exchangeToAsset.decimals))
    }
  }, [exchangeToAsset, exchangeAmount])

  async function onMint() {
    if (!account) {
      Alert.show('Please Connect Wallet First')
      return
    }

    if (unxToken.id && mintAsset.assetId && SYNTH_ADDRESS) {
      if (mintAmount <= 0) {
        Alert.error('Amount should be greater than 0')
        return
      }
      try {
        const args = [
          {
            type: 'Long',
            value: unxToken.id
          },
          {
            type: 'Address',
            value: account
          },
          {
            type: 'Long',
            value: new BigNumber(unxNeededForMint).times(new BigNumber(10 ** unxToken.decimals)).integerValue(BigNumber.ROUND_DOWN).toString()
          },
          {
            type: 'Long',
            value: mintAsset.assetId
          }
        ]
        const mintResult = await client.api.smartContract.invokeWasm({
          scriptHash: SYNTH_ADDRESS,
          operation: 'mint',
          args,
          gasPrice: 2500,
          gasLimit: 60000000,
          requireIdentity: false
        })

        if (mintResult.transaction) {
          setShowMintModal(false)
          setModal('infoModal', {
            show: true,
            type: 'success',
            text: 'Transaction Successful',
            extraText: 'View Transaction',
            extraLink: `${TRANSACTION_BASE_URL}${mintResult.transaction}${TRANSACTION_AFTERFIX}`
          })
        }
      } catch (e) {
        setShowMintModal(false)
        setModal('infoModal', {
          show: true,
          type: 'error',
          text: 'Transaction Failed',
          // extraText: `${e}`,
          extraText: '',
          extraLink: ''
        })
      }
    }
  }

  async function onBurn() {
    if (!account) {
      Alert.show('Please Connect Wallet First')
      return
    }

    if (unxToken.id && burnAsset.assetId && SYNTH_ADDRESS) {
      if (burnAmount <= 0) {
        Alert.error('Amount should be greater than 0')
        return
      }
      try {
        const args = [
          {
            type: 'Long',
            value: unxToken.id
          },
          {
            type: 'Address',
            value: account
          },
          {
            type: 'Long',
            value: burnAsset.assetId
          },
          {
            type: 'Long',
            value: new BigNumber(burnAmount).times(new BigNumber(10 ** burnAsset.decimals)).integerValue(BigNumber.ROUND_DOWN).toString()
          }
        ]
        const burnResult = await client.api.smartContract.invokeWasm({
          scriptHash: SYNTH_ADDRESS,
          operation: 'burn',
          args,
          gasPrice: 2500,
          gasLimit: 60000000,
          requireIdentity: false
        })

        if (burnResult.transaction) {
          setShowBurnModal(false)
          setModal('infoModal', {
            show: true,
            type: 'success',
            text: 'Transaction Successful',
            extraText: 'View Transaction',
            extraLink: `${TRANSACTION_BASE_URL}${burnResult.transaction}${TRANSACTION_AFTERFIX}`
          })
        }
      } catch (e) {
        setShowBurnModal(false)
        setModal('infoModal', {
          show: true,
          type: 'error',
          text: 'Transaction Failed',
          // extraText: `${e}`,
          extraText: '',
          extraLink: ''
        })
      }
    }
  }

  async function onBurnAll() {
    if (!account) {
      Alert.show('Please Connect Wallet First')
      return
    }

    if (unxToken.id && SYNTH_ADDRESS) {
      try {
        const args = [
          {
            type: 'Long',
            value: unxToken.id
          },
          {
            type: 'Address',
            value: account
          }
        ]
        const burnAllResult = await client.api.smartContract.invokeWasm({
          scriptHash: SYNTH_ADDRESS,
          operation: 'burn_all_asset',
          args,
          gasPrice: 2500,
          gasLimit: 60000000,
          requireIdentity: false
        })

        if (burnAllResult.transaction) {
          setModal('infoModal', {
            show: true,
            type: 'success',
            text: 'Transaction Successful',
            extraText: 'View Transaction',
            extraLink: `${TRANSACTION_BASE_URL}${burnAllResult.transaction}${TRANSACTION_AFTERFIX}`
          })
        }
      } catch (e) {
        setModal('infoModal', {
          show: true,
          type: 'error',
          text: 'Transaction Failed',
          // extraText: `${e}`,
          extraText: '',
          extraLink: ''
        })
      }
    }
  }

  async function onExchange() {
    if (!account) {
      Alert.show('Please Connect Wallet First')
      return
    }

    if (unxToken.id && exchangeAsset.assetId && SYNTH_ADDRESS) {
      if (exchangeAmount <= 0) {
        Alert.error('Amount should be greater than 0')
        return
      }
      try {
        const args = [
          {
            type: 'Long',
            value: unxToken.id
          },
          {
            type: 'Address',
            value: account
          },
          {
            type: 'Long',
            value: exchangeAsset.assetId
          },
          {
            type: 'Long',
            value: new BigNumber(exchangeAmount).times(new BigNumber(10 ** exchangeAsset.decimals)).integerValue(BigNumber.ROUND_DOWN).toString()
          },{
            type: 'Long',
            value: exchangeToAsset.assetId
          }
        ]
        const exchangeResult = await client.api.smartContract.invokeWasm({
          scriptHash: SYNTH_ADDRESS,
          operation: 'asset_swap',
          args,
          gasPrice: 2500,
          gasLimit: 60000000,
          requireIdentity: false
        })

        if (exchangeResult.transaction) {
          setShowExchangeModal(false)
          setModal('infoModal', {
            show: true,
            type: 'success',
            text: 'Transaction Successful',
            extraText: 'View Transaction',
            extraLink: `${TRANSACTION_BASE_URL}${exchangeResult.transaction}${TRANSACTION_AFTERFIX}`
          })
        }
      } catch (e) {
        setShowExchangeModal(false)
        setModal('infoModal', {
          show: true,
          type: 'error',
          text: 'Transaction Failed',
          // extraText: `${e}`,
          extraText: '',
          extraLink: ''
        })
      }
    }
  }

  async function onClaim() {
    if (!account) {
      Alert.show('Please Connect Wallet First')
      return
    }

    if (unxToken.id && SYNTH_ADDRESS) {
      try {
        const args = [
          {
            type: 'Long',
            value: unxToken.id
          },
          {
            type: 'Address',
            value: account
          }
        ]
        const mintResult = await client.api.smartContract.invokeWasm({
          scriptHash: SYNTH_ADDRESS,
          operation: 'claim_unx',
          args,
          gasPrice: 2500,
          gasLimit: 60000000,
          requireIdentity: false
        })

        if (mintResult.transaction) {
          setModal('infoModal', {
            show: true,
            type: 'success',
            text: 'Transaction Successful',
            extraText: 'View Transaction',
            extraLink: `${TRANSACTION_BASE_URL}${mintResult.transaction}${TRANSACTION_AFTERFIX}`
          })
        }
      } catch (e) {
        setModal('infoModal', {
          show: true,
          type: 'error',
          text: 'Transaction Failed',
          // extraText: `${e}`,
          extraText: '',
          extraLink: ''
        })
      }
    }
  }

  const maxBurnAmount = () => {
    if (burnAsset) {
      setBurnAmount(burnAsset.balance / (10 ** burnAsset.decimals))
    }
  }

  const maxExchangeAmount = () => {
    if (exchangeAsset) {
      setExchangeAmount(exchangeAsset.balance / (10 ** exchangeAsset.decimals))
    }
  }

  const handleChangeExchangeToAsset = (asset) => {
    setExchangeToAsset(asset)
  }

  const renderAssetList = () => {
    if (synthType === 'mint') {
      if (stat.liveAssets) {
        return stat.liveAssets.map((la) => {
          const accountAsset = marketStat.accountAssetBalances ? marketStat.accountAssetBalances.find((ab) => ab.assetId === la.assetId) : null

          if (accountAsset) {
            la.holdings = accountAsset.assetPrice / SYNTH_PRICE_DECIMALS * accountAsset.balance / (10 ** la.decimals)
          }

          return (
            <div className="synth-assets-list-item" key={la.assetId}>
              <div className="synth-assets-list-item-name">{la.tokenName}</div>
              <div className="synth-assets-list-item-price">{la.price / SYNTH_PRICE_DECIMALS}</div>
              <div className="synth-assets-list-item-holding">{la.holdings || 0}</div>
              <div className="synth-assets-list-item-action">
                <div className="synth-assets-list-item-action-mint" onClick={() => { setShowMintModal(true); setMintAsset(la); }}>Mint</div>
              </div>
            </div>
          )
        })
      }
      return null
    } else {
      if (marketStat.accountAssetBalances) {
        const assetList = marketStat.accountAssetBalances.map((ab) => {
          const asset = stat.liveAssets ? stat.liveAssets.find((la) => la.assetId === ab.assetId) : null

          if (asset) {
            asset.balance = ab.balance
            asset.assetPrice = ab.assetPrice
            asset.effectiveLeverage = asset.assetPrice * asset.times / (asset.entryPrice + (asset.assetPrice - asset.entryPrice) * asset.times)
          }
          return asset ? (
            <div className="synth-assets-list-item" key={ab.assetId}>
              <div className="synth-assets-list-item-name">{asset.tokenName}</div>
              <div className="synth-assets-list-item-price">{ab.assetPrice / SYNTH_PRICE_DECIMALS}</div>
              <div className="synth-assets-list-item-holding">{ab.assetPrice / SYNTH_PRICE_DECIMALS * ab.balance / (10 ** asset.decimals)}</div>
              <div className="synth-assets-list-item-leverage">{asset.effectiveLeverage}</div>
              <div className="synth-assets-list-item-action">
                <div className="synth-assets-list-item-action-burn" onClick={() => { setShowBurnModal(true); setBurnAsset(asset); }}>Burn</div>
                <div className="synth-assets-list-item-action-exchange"
                  onClick={() => {
                    setShowExchangeModal(true)
                    setExchangeAsset(asset)
                    const toAssets = stat.liveAssets.filter((la) => la.assetId !== asset.assetId)
                    setExchangeToAssets(toAssets)
                    setExchangeToAsset(toAssets[0])
                  }}
                >Exchange</div>
              </div>
            </div>
          ) : null
        })

        return assetList
      }
    }
  }

  return (
    <div className="synth-container">
      <div className="synth-overview-sections">
        <div className="synth-overview-section">
          <p className="synth-overview-section-title">Transferable</p>
          <p className="synth-overview-detail">{marketStat.accountStakeValue ? ((marketStat.accountStakeValue / marketStat.marketStakeValue * marketStat.marketTokenBalance) / (10 ** unxToken.decimals)).toFixed(unxToken.decimals) : '0'} <span>UNX</span></p>
        </div>
        <div className="synth-overview-section">
          <p className="synth-overview-section-title">ROI</p>
          <p className="synth-overview-detail">{roi}%</p>
        </div>
        <div className="synth-overview-section">
          <p className="synth-overview-section-title">Rewards Available</p>
          <p className="synth-overview-detail">{availableReward} <span>UNX</span></p>
          { (availableReward && availableReward !== '-') ? <div className="synth-overview-action-btn" onClick={() => onClaim()}>Claim</div> : null }
        </div>
      </div>
      <div className="mint-burn-wrapper">
        <div className="mint-burn-main">
          <div className="synth-type-switch">
            <div className={`synth-type-item ${synthType === 'mint' ? 'selected' : ''}`} onClick={() => setSynthType('mint')}>Mint</div>
            <div className={`synth-type-item ${synthType === 'burn' ? 'selected' : ''}`} onClick={() => setSynthType('burn')}>Burn</div>
          </div>
          <div className="synth-assets-panel">
            <div className="synth-assets-panel-header">
              <div className="panel-header-item">Asset</div>
              <div className="panel-header-item">Price($)</div>
              <div className="panel-header-item">Holdings($)</div>
              {
                synthType === 'burn' ? (
                  <div className="panel-header-item">Effective Leverage</div>
                ) : null
              }
              {
                (synthType === 'burn' && marketStat.accountAssetBalances && marketStat.accountAssetBalances.length) ? (
                  <div className="panel-header-item burn-all-btn" onClick={() => onBurnAll()}>Burn All</div>
                ) : (
                  <div className="panel-header-item"></div>
                )
              }
            </div>
            <div className="synth-assets-list">
              {renderAssetList()}
            </div>
          </div>
        </div>
        {
          synthType === 'mint' ? (
            <div className="mint-burn-info">
              <div className="mint-burn-info-title">Mint Synthetics by staking UNX</div>
              <div className="mint-burn-info-desc">UNX stakers earn staking rewards once minted.</div>
              <div className="mint-burn-account-info">
                {/* <div className="mint-burn-account-info-line">Total <span>{(marketStat.marketStakeValue || 0) / (10 ** unxToken.decimals) || '-'} UNX</span></div> */}
                <div className="mint-burn-account-info-line">Minted With <span>{(marketStat.accountStakeValue || 0) / (10 ** unxToken.decimals) || '0'} UNX</span></div>
              </div>
            </div>
          ) : (
            <div className="mint-burn-info">
              <div className="mint-burn-info-title">Burn Synthetics to unstake UNX</div>
              <div className="mint-burn-info-desc">Burn your synthetics to withdraw UNX.</div>
              <div className="mint-burn-account-info">
                {/* <div className="mint-burn-account-info-line">Total <span>{(marketStat.marketStakeValue || 0) / (10 ** unxToken.decimals) || '-'} UNX</span></div> */}
                <div className="mint-burn-account-info-line">Assets($) <span>{allAssetValue}</span></div>
              </div>
              <div className="mint-burn-info-note"><span>NOTE</span>: when " Effective Leverage" is belower than 0.5 or higher than 2.0 times of nominal leverage, your asset will be frozen. <span>You have to burn it within 3 days.</span> Otherwise, asset will be burned and the UNX will be donated to staked pool.</div>
            </div>
          )
        }
        
      </div>
      {
        showMintModal ? (
          <div className="modal-overlay">
            <div className="modal-wrapper">
              <div className="close-btn" onClick={() => setShowMintModal(false)}></div>
              <div className="mint-wrapper">
                <div className="mint-wrapper-title">Mint {mintAsset.tokenName}</div>
                <div className="mint-wrapper-info">Price($)<span>{mintAsset.price / SYNTH_PRICE_DECIMALS}</span></div>
                <div className="form-item">
                  <div className="input-label">Amount</div>
                  <div className="input-wrapper">
                    <Input placeholder="0.0" value={mintAmount} decimals={mintAsset.decimals || 0} onChange={(amount) => setMintAmount(amount)} />
                  </div>
                </div>
                <div className="form-item">
                  <div className="input-label">You need to pay (UNX)</div>
                  <div className="input-wrapper">
                    <Input placeholder="0.0" value={unxNeededForMint} decimals={unxToken.decimals || 0} onChange={(amount) => setUnxNeededForMint(amount)} />
                  </div>
                </div>
                <div className="mint-btn" onClick={() => onMint()}>Mint</div>
              </div>
            </div>
          </div>
        ) : null
      }
      {
        showBurnModal ? (
          <div className="modal-overlay">
            <div className="modal-wrapper">
              <div className="close-btn" onClick={() => setShowBurnModal(false)}></div>
              <div className="burn-wrapper">
                <div className="burn-wrapper-title">Burn {burnAsset.tokenName}</div>
                <div className="burn-wrapper-info">Price($)<span>{burnAsset.assetPrice / SYNTH_PRICE_DECIMALS}</span></div>
                <div className="form-item">
                  <div className="input-label">Amount</div>
                  <div className="input-wrapper">
                    <Input placeholder="0.0" value={burnAmount} decimals={burnAsset.decimals || 0} onChange={(amount) => setBurnAmount(amount)} />
                    <div className="input-max-btn" onClick={() => maxBurnAmount()}>MAX</div>
                  </div>
                </div>
                <div className="form-item">
                  <div className="input-label">You will get (UNX)</div>
                  <div className="input-wrapper">
                    <Input placeholder="0.0" value={unxGetForBurn} decimals={unxToken.decimals || 0} onChange={(amount) => setUnxGetForBurn(amount)} />
                  </div>
                </div>
                <div className="burn-btn" onClick={() => onBurn()}>Burn</div>
              </div>
            </div>
          </div>
        ) : null
      }
      {
        showExchangeModal ? (
          <div className="modal-overlay">
            <div className="modal-wrapper">
              <div className="close-btn" onClick={() => setShowExchangeModal(false)}></div>
              <div className="exchange-wrapper">
                <div className="exchange-wrapper-title">Exchange {exchangeAsset.tokenName}</div>
                {/* <div className="exchange-wrapper-info">Price($)<span>{exchangeAsset.assetPrice / SYNTH_PRICE_DECIMALS}</span></div> */}
                <div className="form-item">
                  <div className="input-label">Amount</div>
                  <div className="input-wrapper">
                    <Input placeholder="0.0" value={exchangeAmount} decimals={exchangeAsset.decimals || 0} onChange={(amount) => setExchangeAmount(amount)} />
                    <div className="input-max-btn" onClick={() => maxExchangeAmount()}>MAX</div>
                  </div>
                </div>
                <TokenInput
                  label="Exchange to"
                  value={exchangeToAmount}
                  tokens={exchangeToAssets}
                  showBalance={false}
                  withMax={false}
                  onTokenChange={(asset) => handleChangeExchangeToAsset(asset)}
                  />
                {/* <div className="form-item">
                  <div className="input-label">Exchange to</div>
                  <div className="input-wrapper">
                    <Input placeholder="0.0" value={unxGetForBurn} decimals={unxToken.decimals || 0} onChange={(amount) => setUnxGetForBurn(amount)} />
                  </div>
                </div> */}
                <div className="exchange-btn" onClick={() => onExchange()}>Exchange</div>
              </div>
            </div>
          </div>
        ) : null
      }
    </div>
  )
}

export default Synth
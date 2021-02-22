import { client } from '@ont-dev/ontology-dapi'
import React, { useState, useEffect, useCallback } from 'react'
import { useHistory } from "react-router-dom"
import { useMappedState, useDispatch } from 'redux-react-hook'
import { useAlert } from 'react-alert'
import BigNumber from 'bignumber.js'
import TokenInput from '../../components/tokenInput'
import { TRANSACTION_BASE_URL, TRANSACTION_AFTERFIX } from '../../config'
import { useFetchPairs } from '../../hooks/usePair'
import { toLocaleFixed } from '../../utils/common'
import { bestSwap } from '../../utils/swap'
import './index.css'

const Swap = () => {
  const [swapType, setSwapType] = useState('exactin')
  const [token1, setToken1] = useState({})
  const [token2, setToken2] = useState({})
  const [token1Amount, setToken1Amount] = useState('')
  const [token2Amount, setToken2Amount] = useState('')
  const [isValidPair, setIsValidPair] = useState(false)
  const [isValidSwap, setIsValidSwap] = useState(false)
  const [bestPath, setBestPath] = useState([])
  const [showPrice, setShowPrice] = useState(false)
  const [balanceChange, setBalanceChange] = useState(0)
  const { account, slippage, pairs, swapTokens, SWAP_ADDRESS } = useMappedState((state) => ({
    account: state.wallet.account,
    slippage: state.wallet.slippage,
    pairs: state.swap.pairs,
    swapTokens: state.swap.tokens,
    SWAP_ADDRESS: state.gov.poolStat.pools.swap.address
  }))
  const dispatch = useDispatch()
  const setModal = useCallback((modalType, modalDetail) => dispatch({ type: 'SET_MODAL', modalType, modalDetail }), [])
  const Alert = useAlert()
  const history = useHistory()

  useFetchPairs()

  useEffect(() => {
    if (token1.id !== token2.id && token1Amount > 0 && token2Amount > 0 && bestPath.length) {
      setShowPrice(true)
      setIsValidSwap(true)
    } else {
      setShowPrice(false)
      setIsValidSwap(false)
    }
  }, [token1, token2, token1Amount, token2Amount, bestPath])

  useEffect(() => {
    if (swapTokens.length) {
      setToken1(swapTokens[0])
      setToken2(swapTokens[1])
    }
  }, [swapTokens])

  useEffect(() => {
    if (token1.id && token2.id && validPair(token1.id, token2.id)) {
      setIsValidPair(true)
    } else {
      setIsValidPair(false)
    }
  }, [token1, token2])

  function validPair(token1, token2) {
    if (pairs.length) {
      if (token1 && token2 && pairs.find((p) => (p.token1 === token1 && p.token2 === token2) || (p.token1 === token2 && p.token2 === token1))) {
        return true
      }
    }
    return false
  }

  function onChangeToken1(token) {
    if (token.id !== token1.id) {
      setToken1(token)
      setToken1Amount('')
      setToken2Amount('')
    }
  }

  function onChangeToken2(token) {
    if (token.id !== token2.id) {
      setToken2(token)
      setToken1Amount('')
      setToken2Amount('')
    }
  }

  function onToken1AmountChange(amount) {
    if (amount !== token1Amount) {
      setSwapType('exactin')
      setToken1Amount(amount)
      if (pairs.length && amount) {
        const inputAmount = amount * (10 ** token1.decimals)
        const [maxOutput, path] = bestSwap('exactin', inputAmount, pairs, token1.id, token2.id)

        setToken2Amount(new BigNumber(maxOutput).div(10 ** token2.decimals).toString())
        setBestPath(path)
      } else if (Number(amount) === 0) {
        setToken2Amount('')
      }
    }
  }

  function onToken2AmountChange(amount) {
    if (amount !== token2Amount) {
      setSwapType('exactout')
      setToken2Amount(amount)
      if (pairs.length && amount) {
        const outputAmount = amount * (10 ** token2.decimals)
        const [minInput, path] = bestSwap('exactout', outputAmount, pairs, token1.id, token2.id)

        if (minInput === Infinity) {
          setToken1Amount('')
        } else {
          setToken1Amount(new BigNumber(minInput).div(10 ** token1.decimals).toString())
        }
        setBestPath(path)
      } else if (Number(amount) === 0) {
        setToken1Amount('')
      }
    }
  }

  function onNavigateToPool() {
    history.push('/pool')
  }

  async function handleSwap() {
    if (!account) {
      Alert.show('Please Connect Wallet First')
      return
    }
    if (token1Amount <= 0 || token2Amount <= 0) {
      Alert.error('Amount should be greater than 0')
      return
    }
    if (token1.id && token1.id === token2.id) {
      Alert.error('Input should be different')
      return
    }

    if (SWAP_ADDRESS) {
      try {
        const args = [
          {
            type: 'Address',
            value: account
          },
          {
            type: 'Long',
            value: new BigNumber(token1Amount).times(new BigNumber(10 ** token1.decimals)).integerValue(BigNumber.ROUND_DOWN).toString()
          },
          {
            type: 'Long',
            value: new BigNumber(token2Amount).times(new BigNumber(10 ** token2.decimals)).integerValue(BigNumber.ROUND_DOWN).toString()
          },
          {
            type: 'Array',
            value: bestPath.map((p) => ({ type: 'Long', value: p }))
          },
          {
            type: 'Address',
            value: account
          }
        ]
        const swapResult = await client.api.smartContract.invokeWasm({
          scriptHash: SWAP_ADDRESS,
          operation: swapType === 'exactin' ? 'swap_exact_tokens_for_tokens' : 'swap_tokens_for_exact_tokens',
          args,
          gasPrice: 2500,
          gasLimit: 60000000,
          requireIdentity: false
        })

        if (swapResult.transaction) {
          setBalanceChange(balanceChange + 1)
          setToken1Amount('')
          setToken2Amount('')
          setModal('infoModal', {
            show: true,
            type: 'success',
            text: 'Transaction Successful',
            extraText: 'View Transaction',
            extraLink: `${TRANSACTION_BASE_URL}${swapResult.transaction}${TRANSACTION_AFTERFIX}`
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

  function getPrice() {
    return `${toLocaleFixed(token2Amount / token1Amount, 6)} ${token2.name} per ${token1.name}`
  }

  function getMinReceiveOrMaxSold() {
    if (swapType === 'exactin') {
      return <p>Minimum Received:<span>{toLocaleFixed(token2Amount * (1 - slippage / 100), 6)} {token2.name}</span></p>
    } else {
      return <p>Maximum Sold:<span>{toLocaleFixed(token1Amount * (1 + slippage / 100), 6)} {token1.name}</span></p>
    }
  }

  function getPriceImpact() {
    let price
    let pair = pairs.find((p) => p.token1 === token1.id && p.token2 === token2.id)

    if (pair) {
      price = (pair.reserve2 / (10 ** token2.decimals)) / (pair.reserve1 / (10 ** token1.decimals))
    } else {
      pair = pairs.find((p) => p.token1 === token2.id && p.token2 === token1.id)

      if (pair) {
        price = (pair.reserve1 / (10 ** token1.decimals)) / (pair.reserve2 / (10 ** token2.decimals))
      }
    }

    return <p>Price Impact:<span>{Math.abs((token2Amount / token1Amount - price) / price * 100).toFixed(2)}%</span></p>
  }

  function getBestPath() {
    if (bestPath.length) {
      const items = []
      bestPath.map((t, index) => {
        const token = swapTokens.find((tk) => tk.id === t)
        index > 0 && items.push((<div className="icon-arrow-right"></div>))
        items.push((<div className={`path-icon icon-${token.name}`}>{token.name}</div>))

        return t
      })

      return items
    }
  }

  return (
    <div className="sw-wrapper">
      <div className="sw-container">
        <div className="sw-tabs">
          <div className="sw-tab active">Swap</div>
          <div className="sw-tab" onClick={() => onNavigateToPool()}>Pool</div>
        </div>
        <div className="sw-content">
          <TokenInput
            balanceChange={balanceChange}
            label="From"
            tokens={swapTokens}
            value={token1Amount}
            round='up'
            onTokenChange={(token) => onChangeToken1(token)}
            onAmountChange={(amount) => onToken1AmountChange(amount)} />
          <div className="icon-arrow-down"></div>
          <TokenInput
            balanceChange={balanceChange}
            label="To"
            tokens={swapTokens}
            value={token2Amount}
            round='down'
            defaultTokenId={swapTokens.length && swapTokens[1].id}
            onTokenChange={(token) => onChangeToken2(token)}
            onAmountChange={(amount) => onToken2AmountChange(amount)} />
          { showPrice ? <div className="sw-price-wrapper">Price<span className="sw-price-info">{getPrice()}</span></div> : null }
          { isValidPair ? null : <div className="add-liquidity-hint">Add liquidity to enable swaps for this pair.</div> }
          { isValidPair ? ( isValidSwap ? <div className="sw-swap-btn" onClick={() => handleSwap()}>Swap</div> : <div className="sw-swap-btn disabled">Swap</div> ) : <div className="sw-swap-btn disabled">Invalid Liquidity</div> }
        </div>
        {
          isValidPair && isValidSwap ? (
            <div className="sw-hint-wrapper">
              <div className="sw-input-output">{getMinReceiveOrMaxSold()}</div>
              <div className="sw-price-impact">{getPriceImpact()}</div>
              <div className="sw-best-path">
                <p>Route:</p>
                <div className="sw-best-path-list">
                  {getBestPath()}
                </div>
              </div>
            </div>
          ) : null
        }
      </div>
    </div>
  )
}

export default Swap

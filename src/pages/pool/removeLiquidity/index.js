import { client } from '@ont-dev/ontology-dapi'
import React, { useState, useEffect, useCallback } from 'react'
import { useHistory, useLocation } from "react-router-dom"
import { useMappedState, useDispatch } from 'redux-react-hook'
import { utils } from 'ontology-ts-sdk'
import { useAlert } from 'react-alert'
import BigNumber from 'bignumber.js'
import Slider from 'rc-slider'
import { useFetchPairs } from '../../../hooks/usePair';
import { TRANSACTION_BASE_URL, TRANSACTION_AFTERFIX } from '../../../config'
import 'rc-slider/assets/index.css'
import './index.css'

const { StringReader } = utils

const RemoveLiquidity = () => {
  const [liquidityBalance, setLiquidityBalance] = useState(0)
  const [token1, setToken1] = useState({})
  const [token2, setToken2] = useState({})
  const [token1Amount, setToken1Amount] = useState(0)
  const [token2Amount, setToken2Amount] = useState(0)
  const [pair, setPair] = useState({})
  const [amount, setAmount] = useState(0)
  const [showPrice, setShowPrice] = useState(false)
  const { account, slippage, tokens, pairs, SWAP_ADDRESS } = useMappedState((state) => ({
    account: state.wallet.account,
    slippage: state.wallet.slippage,
    tokens: state.common.tokens,
    pairs: state.swap.pairs,
    SWAP_ADDRESS: state.gov.poolStat.pools.swap.address
  }))
  const dispatch = useDispatch()
  const setModal = useCallback((modalType, modalDetail) => dispatch({ type: 'SET_MODAL', modalType, modalDetail }), [])
  const Alert = useAlert()
  const history = useHistory()
  const location = useLocation()
  const pairId = location.pathname.match(/\/([^/]+)$/)[1]

  useFetchPairs()

  useEffect(() => {
    if (account && pairs.length && pairId) {
      getLiquidityBalanceByPairId(pairId).then((resp) => {
        setLiquidityBalance(resp)
      })
    }
  }, [account, pairs, SWAP_ADDRESS])

  useEffect(() => {
    if (tokens.length && pairs.length && pairId) {
      const pair = pairs.find((p) => `${p.id}` === pairId)
      setPair(pair)
      setToken1(tokens.find((t) => t.id === pair.token1))
      setToken2(tokens.find((t) => t.id === pair.token2))
      setShowPrice(true)
    }
  }, [pairs, tokens])

  useEffect(() => {
    if (pair && token1.id && token2.id && pairId && liquidityBalance) {
      const balance = liquidityBalance / (10 ** 18)
      const shareOfPool = Math.sqrt(Math.pow(balance, 2) / (pair.reserve1 * pair.reserve2 / (10 ** (token1.decimals + token2.decimals))))
      const token1Amount = (pair.reserve1 * shareOfPool / (10 ** token1.decimals))
      const token2Amount = (pair.reserve2 * shareOfPool / (10 ** token2.decimals))

      setToken1Amount(amount / 100 * token1Amount)
      setToken2Amount(amount / 100 * token2Amount)
    }
  }, [amount, pair, token1, token2])

  function getLiquidityBalanceByPairId(id) {
    if (SWAP_ADDRESS) {
      return client.api.smartContract.invokeWasmRead({
        scriptHash: SWAP_ADDRESS,
        operation: 'balanceOf',
        args: [
          {
            type: 'Long',
            value: id
          },
          {
            type: 'Address',
            value: account
          }
        ]
      }).then((resp) => {
        const strReader = new StringReader(resp)
        const balance = strReader.readUint128()
        
        return balance
      })
    }
  }

  function getPairPrice() {
    return (pair.reserve2 / (10 ** token2.decimals)) / (pair.reserve1 / (10 ** token1.decimals))
  }

  function onNavigateToPool() {
    history.goBack()
  }

  async function onRemove() {
    if (!account) {
      Alert.show('Please Connect Wallet First')
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
            value: token1.id
          },
          {
            type: 'Long',
            value: token2.id
          },
          {
            type: 'Long',
            value: new BigNumber(liquidityBalance).times(amount / 100).integerValue(BigNumber.ROUND_UP).toString()
          },
          {
            type: 'Long',
            value: new BigNumber(token1Amount).times(10 ** token1.decimals).times(1 - slippage / 100).integerValue(BigNumber.ROUND_UP).toString()
          },
          {
            type: 'Long',
            value: new BigNumber(token2Amount).times(10 ** token2.decimals).times(1 - slippage / 100).integerValue(BigNumber.ROUND_UP).toString()
          },
          {
            type: 'Address',
            value: account
          }
        ]
        const addResult = await client.api.smartContract.invokeWasm({
          scriptHash: SWAP_ADDRESS,
          operation: 'remove_liquidity',
          args,
          gasPrice: 2500,
          gasLimit: 60000000,
          requireIdentity: false
        })

        if (addResult.transaction) {
          setModal('infoModal', {
            show: true,
            type: 'success',
            text: 'Transaction Successful',
            extraText: 'View Transaction',
            extraLink: `${TRANSACTION_BASE_URL}${addResult.transaction}${TRANSACTION_AFTERFIX}`
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

  return (
    <div className="remove-liquidity-wrapper">
      <div className="rl-header">Remove Liquidity
        <div className="back-icon" onClick={() => onNavigateToPool()}></div>
      </div>
      <div className="rl-wrapper">
        <div className="rl-amount">
          <div className="rl-amount-label">Amount<span>{amount}%</span></div>
          <Slider value={amount} onChange={(e) => setAmount(e)} />
          <div className="quick-items">
            <div className="quick-item" onClick={() => setAmount(25)}>25%</div>
            <div className="quick-item" onClick={() => setAmount(50)}>50%</div>
            <div className="quick-item" onClick={() => setAmount(75)}>75%</div>
            <div className="quick-item" onClick={() => setAmount(100)}>Max</div>
          </div>
        </div>
        <div className="icon-arrow-down" />
        <div className="rl-receive-wrapper">
          <div className={`receive-token-item icon-${token1.name}`}>
            {token1.name}
            <span>{token1Amount}</span>
          </div>
          <div className={`receive-token-item icon-${token2.name}`}>
            {token2.name}
            <span>{token2Amount}</span>
          </div>
        </div>
        {
          showPrice ? (
            <div className="rl-price-wrapper">
              <div className="price-wrapper-lable">Price</div>
              <div className="price">1 {token1.name} = {getPairPrice()} {token2.name}</div>
              <div className="price-reverse">1 {token2.name} = {1 / getPairPrice()} {token1.name}</div>
            </div>
          ) : null
        }
        { amount ? <div className="rl-remove-btn" onClick={() => onRemove()}>Remove</div> : <div className="rl-remove-btn disabled">Remove</div> }
      </div>
    </div>
  )
}

export default RemoveLiquidity
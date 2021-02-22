import { client } from '@ont-dev/ontology-dapi'
import React, { useState, useEffect, useCallback } from 'react'
import { utils } from 'ontology-ts-sdk'
import BigNumber from 'bignumber.js'
import { useAlert } from 'react-alert'
import { useMappedState, useDispatch } from 'redux-react-hook';
import { getTokenBalance } from '../../utils/token'
import Input from '../../components/input'
import { handleError } from '../../utils/errorHandle'
import { getHashString } from '../../utils/common'
import { PRICE_DECIMALS } from '../../utils/constants'
import { TRANSACTION_BASE_URL, TRANSACTION_AFTERFIX } from '../../config'
import './index.css'

const { StringReader } = utils

const Transaction = () => {
  const [pairNameKeyword, setPairNameKeyword] = useState('')
  const [pairs, setPairs] = useState([])
  const [tokenPair, setTokenPair] = useState({})
  const [showPairSelectModal, setShowPairSelectModal] = useState(false)
  const [tradeType, setTradeType] = useState('buy')
  const [tokenBalance, setTokenBalance] = useState('-')
  const [makes, setMakes] = useState([])
  const [myMakes, setMyMakes] = useState([])
  const [makeView, setMakeView] = useState('all')
  const [price, setPrice] = useState('')
  const [amount, setAmount] = useState('')
  const [total, setTotal] = useState('')
  const [pool, setPool] = useState([])
  const [lastPrice, setLastPrice] = useState(0)
  const [feeRate, setFeeRate] = useState(0)
  const [isValid, setIsValid] = useState(false)
  const { account, stopInterval, tokens, CONTRACT_ADDRESS } = useMappedState((state) => ({
    account: state.wallet.account,
    stopInterval: state.common.stopInterval,
    tokens: state.common.tokens,
    CONTRACT_ADDRESS: state.gov.poolStat.pools.dex.address
  }))
  const dispatch = useDispatch()
  const setModal = useCallback((modalType, modalDetail) => dispatch({ type: 'SET_MODAL', modalType, modalDetail }), [])
  const setStopInterval = useCallback((stopInterval) => dispatch({ type: 'SET_STOP_INTERVAL', stopInterval }), [])

  const Alert = useAlert()

  const urlPairName = decodeURIComponent(getHashString(window.location.hash, 'pair') || '')

  useEffect(() => {
    if (pairs.length && !tokenPair.name) {
      setTokenPair(pairs.find((p) => p.name === `${urlPairName}`) || pairs[0])
    }
  }, [pairs])

  useEffect(() => {
    if (account && tokenPair.name) {
      setTokenBalance('-')
      getTokenBalance(account, tradeType === 'buy' ? tokenPair.tokens[1] : tokenPair.tokens[0], (bl) => {
        setTokenBalance(bl)
      })
    }
  }, [account, tokenPair, tradeType])

  useEffect(() => {
    function getMakesOfPair() {
      if (tokenPair.name && CONTRACT_ADDRESS) {
        try {
          client.api.smartContract.invokeWasmRead({
            scriptHash: CONTRACT_ADDRESS,
            operation: 'get_makes_of_pair',
            args: [
              {
                type: 'Long',
                value: tokenPair.tokens[0].id
              },
              {
                type: 'Long',
                value: tokenPair.tokens[1].id
              }
            ]
          })
          .then((makeStr) => {
            const parsedMakes = []
            const strReader = new StringReader(makeStr)
            const pairLastPrice = strReader.readUint128()
    
            for (let j = 0; j <= 1; j++) {
              const makeCount = strReader.readNextLen()
              for (let i = 0; i < makeCount; i++) {
                const make = {}
                make.make_id = strReader.readUint128()
                make.price = strReader.readUint128()
                make.amount = new BigNumber(strReader.readUint128()).toString()
                make.asset_token_id = (j === 0 ? tokenPair.tokens[0].id : tokenPair.tokens[1].id)
                make.price_token_id = (j === 0 ? tokenPair.tokens[1].id : tokenPair.tokens[0].id)
        
                parsedMakes.push(make)
              }
            }
    
            setLastPrice(pairLastPrice ? pairLastPrice / PRICE_DECIMALS : 0)
            setMakes(parsedMakes)
          })
          .catch((e) => {
            handleError(e, (errorCode) => {
              if (errorCode === 'CONTRACT_ADDRESS_ERROR') {
                setStopInterval(true)
              } else {
                console.log('get makes of pair', e)
              }
            })
          })
        } catch (e) {
          console.log(e)
        }
      }
    }
    getMakesOfPair()
    const interval = !stopInterval && setInterval(getMakesOfPair, 2000)
    return () => {
      interval && clearInterval(interval)
    }
  }, [tokenPair, account, stopInterval, CONTRACT_ADDRESS])

  useEffect(() => {
    function getUserMakes() {
      if (account && CONTRACT_ADDRESS) {
        try {
          client.api.smartContract.invokeWasmRead({
            scriptHash: CONTRACT_ADDRESS,
            operation: 'get_user_makes',
            args: [
              {
                type: 'Address',
                value: account
              }
            ]
          })
          .then((makeStr) => {
            const parsedMakes = []
            const strReader = new StringReader(makeStr)
            const makeCount = strReader.readNextLen()
            for (let i = 0; i < makeCount; i++) {
              const make = {}
              make.address = client.api.utils.hexToAddress(strReader.read(20))
              make.asset_token_id = strReader.readUint128()
              make.price_token_id = strReader.readUint128()
              make.price = strReader.readUint128()
              make.amount = strReader.readUint128()
              make.make_id = strReader.readUint128()
    
              parsedMakes.push(make)
            }
    
            setMyMakes(parsedMakes)
          })
          .catch((e) => {
            handleError(e, (errorCode) => {
              if (errorCode === 'CONTRACT_ADDRESS_ERROR') {
                setStopInterval(true)
              } else {
                console.log('get user makes', e)
              }
            })
          })
        } catch (e) {
          console.log(e)
        }
      }
    }

    getUserMakes()
    const interval = !stopInterval && setInterval(getUserMakes, 5000)
    return () => {
      interval && clearInterval(interval)
    }
  }, [tokenPair, account, stopInterval, CONTRACT_ADDRESS])

  useEffect(() => {
    async function getStat() {
      if (tokens.length && CONTRACT_ADDRESS) {
        try {
          const statStr = await client.api.smartContract.invokeWasmRead({
            scriptHash: CONTRACT_ADDRESS,
            operation: 'stat',
            args: []
          })
          
          const tokenPool = []
          const strReader = new StringReader(statStr)
          setFeeRate(strReader.readUint128())
          const tokenCount = strReader.readNextLen()
  
          for (let i = 0; i < tokenCount; i++) {
            const token = {}
            token.id = strReader.readUint128()
            const tempToken = tokens.find((t) => t.id === token.id)
            token.balance = new BigNumber(strReader.readUint128()).div(new BigNumber(10 ** tempToken.decimals)).toString()
  
            tokenPool.push(Object.assign(tempToken, token))
          }

          if (!pairs.length) {
            const tokenPairs = []
            for (let i = 0; i < tokenPool.length; i++) {
              for (let j = i + 1; j < tokenPool.length; j++) {
                tokenPairs.push({
                  name: `${tokenPool[i].name}/${tokenPool[j].name}`,
                  tokens: [tokenPool[i], tokenPool[j]]
                })
              }
            }

            setPairs(tokenPairs)
          }

          setPool(tokenPool)
        } catch (e) {
          handleError(e, (errorCode) => {
            if (errorCode === 'CONTRACT_ADDRESS_ERROR') {
              setStopInterval(true)
            } else {
              console.log('get stat', e)
            }
          })
        }
      }
    }

    getStat()
    const interval = setInterval(() => {
      if (stopInterval) {
        clearInterval(interval)
      } else {
        getStat()
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [tokens, pairs, stopInterval, CONTRACT_ADDRESS])

  useEffect(() => {
    if (price > 0 && amount > 0) {
      setTotal(price * amount)
    }
  }, [price, amount])

  useEffect(() => {
    if (price > 0) {
      setAmount((total || 0) / price)
    }
  }, [total])

  useEffect(() => {
    if (tokenPair.name && price > 0 && amount > 0) {
      setIsValid(true)
    } else {
      setIsValid(false)
    }
  }, [tokenPair, amount, price])

  useEffect(() => {
    setMakeView('all')
  }, [account])

  function onChangeToUserMakeView() {
    if (account) {
      setMakeView('my')
    } else {
      Alert.show('Please Connect Wallet First')
    }
  }

  function getMakes(type) {
    if (tokenPair.name) {
      const curMakes = (makeView === 'my' ? myMakes : makes)
      if (type === 'sell') {
        return curMakes.filter((m) => m.asset_token_id === tokenPair.tokens[0].id && m.price_token_id === tokenPair.tokens[1].id).map((m) => {
          return (
            <div key={m.make_id} className="my-make-item reverse">
              <div className="make-item-detail make-sell">{m.price / PRICE_DECIMALS}</div>
              <div className="make-item-detail">{new BigNumber(m.amount).div(Math.pow(10, tokenPair.tokens[0].decimals)).toString()}</div>
              { makeView === 'my' && <div className="unmake-btn" onClick={() => onUnmake(m.make_id)}>Cancel</div> }
            </div>)
        })
      } else {
        return curMakes.filter((m) => m.asset_token_id === tokenPair.tokens[1].id && m.price_token_id === tokenPair.tokens[0].id).map((m) => {
          return (
            <div key={m.make_id} className="my-make-item">
              <div className="make-item-detail make-buy">{PRICE_DECIMALS / m.price}</div>
              <div className="make-item-detail">{new BigNumber(m.amount).times(m.price).div(PRICE_DECIMALS).div(Math.pow(10, tokenPair.tokens[1].decimals)).toString()}</div>
              { makeView === 'my' && <div className="unmake-btn" onClick={() => onUnmake(m.make_id)}>Cancel</div> }
            </div>)
        })
      }
    }
    return null
  }



  async function onMake() {
    if (!account) {
      Alert.show('Please Connect Wallet First')
      return
    }
    if (tokenPair.name && CONTRACT_ADDRESS) {
      if (price <= 0) {
        Alert.error('Price should be greater than 0')
        return
      }
      if (amount <= 0) {
        Alert.error('Amount should be greater than 0')
        return
      }
      try {
        const assetToken = tradeType === 'buy' ? tokenPair.tokens[1] : tokenPair.tokens[0]
        const priceToken = tradeType === 'buy' ? tokenPair.tokens[0] : tokenPair.tokens[1]
        const tradePrice = tradeType === 'buy' ? 1 / price : price
        const tradeAmount = tradeType === 'buy' ? total : amount
        const args = [
          {
            type: 'Address',
            value: account
          },
          {
            type: 'Long',
            value: assetToken.id
          },
          {
            type: 'Long',
            value: priceToken.id
          },
          {
            type: 'Long',
            value: new BigNumber(tradePrice).times(PRICE_DECIMALS).integerValue(BigNumber.ROUND_DOWN).toString()
          },
          {
            type: 'Long',
            value: new BigNumber(tradeAmount).times(new BigNumber(10 ** assetToken.decimals)).integerValue(BigNumber.ROUND_DOWN).toString()
          }
        ]
        const makeResult = await client.api.smartContract.invokeWasm({
          scriptHash: CONTRACT_ADDRESS,
          operation: 'make',
          args,
          gasPrice: 2500,
          gasLimit: 60000000,
          requireIdentity: false
        })

        if (makeResult.transaction) {
          setAmount('')
          setPrice('')
          setTotal('')
          setModal('infoModal', {
            show: true,
            type: 'success',
            text: 'Transaction Successful',
            extraText: 'View Transaction',
            extraLink: `${TRANSACTION_BASE_URL}${makeResult.transaction}${TRANSACTION_AFTERFIX}`
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

  async function onUnmake(makeId) {
    if (account && makeId && CONTRACT_ADDRESS) {
      try {
        const unmakeResult = await client.api.smartContract.invokeWasm({
          scriptHash: CONTRACT_ADDRESS,
          operation: 'unmake',
          args: [
            {
              type: 'Address',
              value: account
            },
            {
              type: 'Long',
              value: makeId
            }
          ],
          gasPrice: 2500,
          gasLimit: 60000000,
          requireIdentity: false
        })
        if (unmakeResult.transaction) {
          setModal('infoModal', {
            show: true,
            type: 'success',
            text: 'Transaction Successful',
            extraText: 'View Transaction',
            extraLink: `${TRANSACTION_BASE_URL}${unmakeResult.transaction}${TRANSACTION_AFTERFIX}`
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

  function getPriceHint() {
    if (tokenPair.name) {
      return tokenPair.tokens[1].name
    }
  }

  function getAmountHint() {
    if (tokenPair.name) {
      return tokenPair.tokens[0].name
    }
  }

  function generateTokenPool() {
    if (pool.length) {
      return pool.filter((tp) => Number(tp.balance) !== 0).map((tp) => {
        return (
          <div className="pool-item" key={tp.name}>
            <div className={`icon-${tp.name} token-name`}>{tp.name}</div>
            <div className="token-balance">{tp.balance}</div>
          </div>
        )
      })
    }
  }

  const handlePairClick = (pair) => {
    setTokenPair(pair)
    setShowPairSelectModal(false)
  }

  return (
    <div className="swap-wrapper">
      <div className="trade-container">
        <div className="make-wrapper">
          <div className="container-header">Trade
            {
              tokenPair.name ? (
                <div className="token-pair-select" onClick={() => setShowPairSelectModal(true)}>
                  <div className="token-pair-name">{tokenPair.name}</div>
                </div>
              ) : null
            }
          </div>
          <div className="trade-type-switch">
            <div className={`trade-type-item ${tradeType === 'buy' ? 'trade-buy' : ''}`} onClick={() => setTradeType('buy')}>Buy</div>
            <div className={`trade-type-item ${tradeType === 'sell' ? 'trade-sell' : ''}`} onClick={() => setTradeType('sell')}>Sell</div>
          </div>
          <div className="form-item">
            <div className="item-title">Price
              <span className="hint">{getPriceHint()}</span>
            </div>
            <div className="input-wrapper">
              <Input placeholder="0.0" value={price} decimals="9" onChange={(amount) => setPrice(amount)} />
            </div>
          </div>
          <div className="form-item">
            <div className="item-title">Amount
              <span className="hint">{getAmountHint()}</span>
            </div>
            <div className="input-wrapper">
              <Input placeholder="0.0" value={amount} decimals={tokenPair.tokens ? tokenPair.tokens[0].decimals : '9'} onChange={(amount) => setAmount(amount)} />
            </div>
          </div>
          <div className="form-item">
            <div className="item-title">Total {tradeType === 'buy' ? 'Need' : 'Receive'}
              <span className="hint">{getPriceHint()}</span>
            </div>
            <div className="input-wrapper">
              <Input placeholder="0.0" value={total} decimals="9" onChange={(amount) => setTotal(amount)} />
            </div>
          </div>
          { tokenPair.name ? <div className="balance-line">Balance: <span>{tokenBalance} {tradeType === 'buy' ? tokenPair.tokens[1].name : tokenPair.tokens[0].name}</span></div> : null }
          { feeRate ? <p className="fee-rate">* The fee rate of transaction is {feeRate / 100}%</p> : null }
          { isValid ? <div className={`make-btn make-btn-${tradeType}`} onClick={() => onMake()}>{tradeType.toUpperCase()} {tokenPair.tokens[0].name}</div> : <div className="make-btn disabled">{tradeType.toUpperCase()} {tokenPair.tokens ? tokenPair.tokens[0].name : ''}</div> }
        </div>
        <div className="trade-panel">
          <div className="panel-header">
            <div className="panel-title">Order Book</div>
            <div className="tabs">
              <div className={makeView === 'all' ? "tab-wrapper selected" : "tab-wrapper"} onClick={() => setMakeView('all')}>All</div>
              <div className={makeView === 'my' ? "tab-wrapper selected" : "tab-wrapper"} onClick={() => onChangeToUserMakeView()}>My</div>
            </div>
          </div>
          <div className="list-title">
            <div className="blank-placeholder"></div>
            <div className="title-items">
              <div className="item-text">Price ({getPriceHint()})</div>
              <div className="item-text">Amount ({getAmountHint()})</div>
              { makeView === 'my' && <div className="item-placeholder"></div> }
            </div>
          </div>
          <div className="sell-section">
            <div className="section-title">Sell</div>
            <div className="make-list reverse">
            {getMakes('sell')}
            </div>
          </div>
          {
            (makeView === 'all' && Number(lastPrice) !== 0) ? <div className="last-price-wrapper">
              <div className="last-price-label">Last Price</div>
              <div className="last-price">{lastPrice}</div>
              <div className="last-price-placeholder"></div>
            </div> : null
          }
          <div className="buy-section">
            <div className="section-title">Buy</div>
            <div className="make-list">
            {getMakes('buy')}
            </div>
          </div>
        </div>
      </div>
      <div className="token-pool">
        <div className="container-header">Token Balance</div>
        <div className="pool-items">
        {generateTokenPool()}
        </div>
      </div>
      {
        showPairSelectModal ? (
          <div className="modal-overlay">
            <div className="modal-wrapper">
              <div className="close-btn" onClick={() => setShowPairSelectModal(false)}></div>
              <div className="pair-select-modal-wrapper">
                <div className="pair-select-modal-title">Select</div>
                <input type="text" className="pair-select-modal-input" value={pairNameKeyword} onInput={(e) => setPairNameKeyword(e.target.value)} />
                <div className="pair-select-modal-list">
                  {
                    pairs.filter((p) => {
                      const nameLC = p.name.toLowerCase()
                      const tNames = pairNameKeyword.split(' ').filter((n) => n)
                      
                      return tNames.reduce((a, b) => a && nameLC.indexOf(b) >= 0, true)
                    }).map((p) => {
                      return (
                        <div key={p.name} className="pair-select-modal-list-item" onClick={() => handlePairClick(p)}>
                          {
                            p.tokens.map((t) => <div key={`${p.name}-${t.name}`} className={`pair-select-modal-list-item-icon icon-${t.name}`}></div>)
                          }
                          <div className="pair-select-modal-list-item-name">{p.name}</div>
                        </div>
                      )
                    })
                  }
                </div>
              </div>
            </div>
          </div>
        ) : null
      }
    </div>
  )
}

export default Transaction
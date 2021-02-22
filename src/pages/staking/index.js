import { client } from '@ont-dev/ontology-dapi'
import React, { useState, useEffect, useCallback } from 'react'
import { useHistory } from "react-router-dom"
import { utils } from 'ontology-ts-sdk'
import BigNumber from 'bignumber.js'
import Tooltip from 'rc-tooltip'
import { useAlert } from 'react-alert'
import { useMappedState, useDispatch } from 'redux-react-hook'
import { getTokenIconDom } from '../../utils/token'

import 'rc-tooltip/assets/bootstrap.css'
import './index.css'

const { StringReader } = utils

const Staking = () => {
  const [showClosed, setShowClosed] = useState(false)
  const { account, tokens, stakingTokens, STAKING_ADDRESS } = useMappedState((state) => ({
    account: state.wallet.account,
    tokens: state.common.tokens,
    stakingTokens: state.staking.tokens,
    STAKING_ADDRESS: state.gov.poolStat.pools.staking.address
  }))
  const dispatch = useDispatch()
  const setStakingTokens = useCallback((tokens) => dispatch({ type: 'SET_STAKING_TOKENS', tokens }), [])
  const history = useHistory()
  const Alert = useAlert()

  useEffect(() => {
    getStakingTokenBalance()
    let interval = setInterval(() => getStakingTokenBalance, 2000)
    return () => {
      interval && clearInterval(interval)
    }
  }, [tokens, STAKING_ADDRESS])

  function getStakingTokenBalance() {
    if (tokens.length && STAKING_ADDRESS) {
      try {
        client.api.smartContract.invokeWasmRead({
          scriptHash: STAKING_ADDRESS,
          operation: 'stat',
          args: []
        }).then((statStr) => {
          const parsedTokens = []
          const strReader = new StringReader(statStr)
          const tokenCount = strReader.readNextLen()
          for (let i = 0; i < tokenCount; i++) {
            const token = {}
            token.id = strReader.readUint128()
            const tempToken = tokens.find((t) => t.id === token.id)
            token.weight = strReader.readUint128()
            token.balance = strReader.readUint128()

            parsedTokens.push(Object.assign(tempToken, token))
          }

          const totalWeight = parsedTokens.filter((t) => t.balance).reduce((a, b) => a + b.weight, 0)
          const filteredTokens = parsedTokens.map((t) => {
            return {
              ...t,
              originWeight: t.weight,
              weight: t.balance ? (t.weight / totalWeight) : 0
            }
          })

          setStakingTokens(filteredTokens)
        })
        .catch((e) => {
          console.log(e)
        })
      } catch (e) {
        console.log(e)
      }
    }
  }

  // useEffect(() => {
  //   client.api.smartContract.invokeWasmRead({
  //     scriptHash: STAKING_ADDRESS,
  //     operation: 'staking_info',
  //     args: []
  //   })
  //   .then((infoStr) => {
  //     const info = {}
  //     const strReader = new StringReader(infoStr)
  //     info.amount = strReader.readUint128()
  //     info.period = strReader.readUint128()
  //     info.start_time = strReader.readUint128()
  //     info.settled_time = strReader.readUint128()
  //     info.interest = info.amount / info.period

  //     setStakingInfo(info)
  //   })
  //   .catch((e) => {
  //     handleError(e, (errorCode) => {
  //       if (errorCode === 'CONTRACT_ADDRESS_ERROR') {
  //         setStopStakingInterval(true)
  //       } else {
  //         console.log('get staking info', e)
  //       }
  //     })
  //   })
  // }, [])

  function onSelectToken(token) {
    if (!account) {
      Alert.show('Please Connect Wallet First')
      return
    }
    history.push(`/staking/${token.id}`)
  }

  function getTip(token) {
    return `${token.name} is the hidden receipt for WING ${token.name.replace('f', '')} suppliers`
  }

  function generateStakingPool() {
    if (stakingTokens.length) {
      const openStakingTokens = stakingTokens.filter((t) => !!t.originWeight)
      const closedStakingTokens = stakingTokens.filter((t) => !t.originWeight)

      return (showClosed ? closedStakingTokens : openStakingTokens).map((token) => {
        return (
          <div className={`pool-list-item ${!showClosed ? '' : 'pool-list-item-disabled'}`} key={token.name}>
            <div className="item-detail">
              <div className="item-detail-wrapper">
                { token.ty === 3 && <div className="corner-badge">10X</div> }
                <div className="staking-token">
                  {
                    token.ty === 3 ? (
                      <div className="staking-text">Deposit
                        {getTokenIconDom(token, 'stake-lp-token')}
                      </div>
                    ) : (
                      <div className={`staking-text icon-${token.name}`}>Deposit</div>
                    )
                  }
                  {
                    token.name.startsWith('f') ? (
                      <Tooltip placement="top" overlay={getTip(token)}>
                        <div className="staking-token-name">{token.name}</div>
                      </Tooltip>
                    ) : <div className="staking-token-name">{token.name}</div>
                  }
                </div>
                <div className="earn-line">Earn<span>UNX</span></div>
                <div className="total-staking">Total Staking<span>{new BigNumber(token.balance || 0).div(10 ** token.decimals).toString()}</span></div>
                <div className="select-btn" onClick={() => onSelectToken(token)}>{ showClosed ? 'Unstake' : 'Stake' }</div>
              </div>
            </div>
          </div>
        )
      })
    }
  }

  return (
    <div className="stake-container">
      <div className="stake-pool">
        { !stakingTokens.length ? <div className="title">Loading...</div> : null }
        {
          showClosed ? (
            <div className="unstake-pool-title">
              <div className="back-icon" onClick={() => setShowClosed(false)}></div>
              Unstake from Closed Pool
            </div>
          ) : null
        }
        <div className="pool-list">
          {generateStakingPool()}
        </div>
        { !showClosed ? <div className="closed-pool-entrance" onClick={() => setShowClosed(true)}>Unstake from Closed Pool</div> : null }
      </div>
    </div>
  )
}

export default Staking
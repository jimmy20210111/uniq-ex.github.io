import { client } from '@ont-dev/ontology-dapi'
import React, { useState, useEffect } from 'react'
import { useHistory } from "react-router-dom"
import { useMappedState } from 'redux-react-hook';
import { utils } from 'ontology-ts-sdk'
import { useFetchPairs } from '../../hooks/usePair'
import './index.css'

const { StringReader } = utils

const Pool = () => {
  const [liquidityBalance, setLiquidityBalance] = useState([])
  const { account, tokens, pairs, SWAP_ADDRESS } = useMappedState((state) => ({
    account: state.wallet.account,
    tokens: state.common.tokens,
    pairs: state.swap.pairs,
    SWAP_ADDRESS: state.gov.poolStat.pools.swap.address
  }))

  const history = useHistory()

  useFetchPairs()

  useEffect(() => {
    if (account && pairs.length && SWAP_ADDRESS) {
      const getLiquidityBalanceByPairId = (id) => {
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
          
          return { [id]: balance }
        })
      }
      Promise.all(pairs.map((p) => getLiquidityBalanceByPairId(p.id))).then((resp) => {
        setLiquidityBalance(resp)
      })
    }
  }, [account, pairs, SWAP_ADDRESS])

  function onNavigateToSwap() {
    history.push('/swap')
  }

  function onNavigateToAddLiquidity() {
    history.push('/pool/add')
  }

  function onRemoveLiquidity(pairId) {
    history.push(`/pool/remove/${pairId}`)
  }

  function generateLiquidityList() {
    const myLiquidities = liquidityBalance.filter((l) => l[Object.keys(l)[0]])
    if (myLiquidities.length && pairs.length && tokens.length) {
      return myLiquidities.map((lb) => {
        const pairId = Object.keys(lb)[0]
        const pair = pairs.find((p) => `${p.id}` === pairId)
        const token1 = tokens.find((t) => t.id === pair.token1)
        const token2 = tokens.find((t) => t.id === pair.token2)
        const balance = lb[pairId] / (10 ** 18)
        const shareOfPool = Math.sqrt(Math.pow(balance, 2) / (pair.reserve1 * pair.reserve2 / (10 ** (token1.decimals + token2.decimals))))
        const token1Amount = (pair.reserve1 * shareOfPool / (10 ** token1.decimals)).toFixed(token1.decimals)
        const token2Amount = (pair.reserve2 * shareOfPool / (10 ** token2.decimals)).toFixed(token2.decimals)
        
        return (
          <div className="pool-liquidity-item">
            <div className="liquidity-item-detail">
              <div className={`token-icon icon-${token1.name}`}></div>
              <div className={`token-icon icon-${token2.name}`}></div>
              <div className="token-pair"><strong>{token1.name}/{token2.name}</strong></div>
              <div className="pair-position"><strong>Pooled</strong>: {token1Amount} / {token2Amount}</div>
              <div className="pool-tokens"><strong>Pool Tokens</strong>: {balance.toFixed(9)}</div>
            </div>
            <div className="remove-liquidity-btn" onClick={() => onRemoveLiquidity(pairId)}>Remove</div>
          </div>
        )
      })
    } else {
      return <div className="pool-empty-lp">No Liquidities</div>
    }
  }

  return (
    <div className="pool-wrapper">
      <div className="pool-container">
        <div className="sw-tabs">
          <div className="sw-tab" onClick={() => onNavigateToSwap()}>Swap</div>
          <div className="sw-tab active">Pool</div>
        </div>
        <div className="pool-content">
          <div className="pool-add-liquidity-btn" onClick={() => onNavigateToAddLiquidity()}>Add Liquidity</div>
          <div className="pool-liquidity-list">
            <div className="my-liquidity">Your Liquidity</div>
            {generateLiquidityList()}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Pool
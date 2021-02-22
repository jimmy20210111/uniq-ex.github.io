import { useEffect, useCallback } from 'react'
import { client } from '@ont-dev/ontology-dapi'
import { utils } from 'ontology-ts-sdk'
import { useMappedState, useDispatch } from 'redux-react-hook'

const { StringReader, reverseHex } = utils

export const useFetchPairs = () => {
  const { account, tokens, swapTokens, SWAP_ADDRESS } = useMappedState((state) => ({
    account: state.wallet.account,
    tokens: state.common.tokens,
    swapTokens: state.swap.tokens,
    SWAP_ADDRESS: state.gov.poolStat.pools.swap.address
  }))
  const dispatch = useDispatch()
  const setSwapTokens = useCallback((tokens) => dispatch({ type: 'SET_SWAP_TOKENS', tokens }), [])
  const setPairs = useCallback((pairs) => dispatch({ type: 'SET_PAIRS', pairs }), [])

  useEffect(() => {
    getSwapStat()
    let interval = setInterval(getSwapStat, 3000)
    return () => {
      interval && clearInterval(interval)
    }
  }, [account, tokens, swapTokens, SWAP_ADDRESS])

  function getSwapStat() {
    if (SWAP_ADDRESS) {
      try {
        client.api.smartContract.invokeWasmRead({
          scriptHash: SWAP_ADDRESS,
          operation: 'stat',
          args: []
        })
        .then((pairStr) => {
          const parsedPairs = []
          const strReader = new StringReader(pairStr)
          const pairCount = strReader.readNextLen()
          for (let i = 0; i < pairCount; i++) {
            const pair = {}
            pair.address = reverseHex(strReader.read(20))
            pair.token1 = strReader.readUint128()
            pair.token2 = strReader.readUint128()
            pair.id = strReader.readUint128()
            pair.reserve1 = strReader.readUint128()
            pair.reserve2 = strReader.readUint128()
            pair.lp = strReader.readUint128()

            parsedPairs.push(pair)
          }

          const tokenIds = []
          const tokenCount = strReader.readNextLen()
          for (let i = 0; i < tokenCount; i++) {
            tokenIds.push(strReader.readUint128())
          }

          setPairs(parsedPairs)
          if (tokens.length && !swapTokens.length) {
            setSwapTokens(tokenIds.map((t) => tokens.find((tk) => tk.id === t)))
          }
        })
        .catch((e) => {
          console.log(e)
        })
      } catch (e) {
        console.log(e)
      }
    }
  }

  return null
}
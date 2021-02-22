import { useEffect, useCallback } from 'react'
import { client } from '@ont-dev/ontology-dapi'
import { utils } from 'ontology-ts-sdk'
import { GOVERNANCE_ADDRESS } from '../config'
import { handleError } from '../utils/errorHandle'
import { useMappedState, useDispatch } from 'redux-react-hook'

const { StringReader, hexstr2str, reverseHex } = utils

export const useFetchTokens = () => {
  const { stopInterval, tokens } = useMappedState((state) => ({
    stopInterval: state.common.stopInterval,
    tokens: state.common.tokens
  }))
  const dispatch = useDispatch()
  const setLoadingToken = useCallback((loadingToken) => dispatch({ type: 'SET_LOADING_TOKEN', loadingToken }), [])
  const setTokens = useCallback((tokens) => dispatch({ type: 'SET_TOKENS', tokens }), [])
  const setStopInterval = useCallback((stopInterval) => dispatch({ type: 'SET_STOP_INTERVAL', stopInterval }), [])
  const setPoolStat = useCallback((poolStat) => dispatch({ type: 'SET_POOL_STAT', poolStat }), [])

  useEffect(() => {
    getGovStat()
    let interval = !stopInterval && !tokens.length && setInterval(() => getGovStat, 1000)
    return () => {
      interval && clearInterval(interval)
    }
  }, [tokens, stopInterval])

  function getGovStat() {
    if (!tokens.length) {
      try {
        client.api.smartContract.invokeWasmRead({
          scriptHash: GOVERNANCE_ADDRESS,
          operation: 'stat',
          args: []
        }).then((statStr) => {
          const strReader = new StringReader(statStr)
          const distributionInfo = {}
          distributionInfo.amount = strReader.readUint128() / (10 ** 9)
          distributionInfo.period = strReader.readUint128()
          distributionInfo.startTimeStamp = strReader.readUint128()
          distributionInfo.settledTimeStamp = strReader.readUint128()
    
          const pools = {}
          const poolCount = strReader.readNextLen()
          for (let i = 0; i < poolCount; i++) {
            const pool = {}
            const nameLength = strReader.readNextLen()
            pool.name = hexstr2str(strReader.read(nameLength))
            pool.address = reverseHex(strReader.read(20))
            pool.weight = strReader.readUint128()
            pools[pool.name] = pool
          }
    
          const upgrade = strReader.readBoolean()
          const parsedTokens = []
          const tokenCount = strReader.readNextLen()
          for (let i = 0; i < tokenCount; i++) {
            const token = {}
            token.id = strReader.readUint128()
            const nameLength = strReader.readNextLen()
            token.name = hexstr2str(strReader.read(nameLength))
            token.address = reverseHex(strReader.read(20))
            token.ty = strReader.readUint8()
            token.decimals = strReader.readUint128()

            token.value = token.id
            token.label = token.name

            parsedTokens.push(token)
          }

          setLoadingToken(false)
          setTokens(parsedTokens)
          setPoolStat({
            distributionInfo,
            pools,
            upgrade
          })
        })
        .catch((e) => {
          console.log(e)
          handleError(e, (errorCode) => {
            console.log(errorCode)
            if (errorCode === 'CONTRACT_ADDRESS_ERROR') {
              setStopInterval(true)
            } else {
              console.log('get all tokens', e)
            }
          })
        })
      } catch (e) {
        console.log(e)
      }
    }
  }

  return null
}
import { client } from '@ont-dev/ontology-dapi'
import React, { useState, useEffect, useCallback } from 'react'
import { useHistory, useLocation } from "react-router-dom"
import { utils, WebsocketClient, CONST, Crypto } from 'ontology-ts-sdk'
import BigNumber from 'bignumber.js'
import { useAlert } from 'react-alert'
import { useMappedState, useDispatch } from 'redux-react-hook';
import { STAKING_ADDRESS, TRANSACTION_BASE_URL, TRANSACTION_AFTERFIX } from '../../../config'
import './index.css'


const { Address } = Crypto
const webSocketClient = new WebsocketClient(CONST.TEST_ONT_URL_2.SOCKET_URL, false, false)
const { StringReader, reverseHex } = utils

const StakingDetail = (props) => {
  const [stakeToken, setStakeToken] = useState({})
  const [tokenBalance, setTokenBalance] = useState(0)
  const [amount, setAmount] = useState('')
  const [myStake, setMyStake] = useState({})
  const [stakeType, setStakeType] = useState('stake')
  const [showStakingModal, setShowStakingModal] = useState(false)
  const { account, tokens } = useMappedState((state) => ({
    account: state.wallet.account,
    tokens: state.common.tokens
  }))
  const dispatch = useDispatch()
  const setModal = useCallback((modalType, modalDetail) => dispatch({ type: 'SET_MODAL', modalType, modalDetail }), [])

  const Alert = useAlert()
  const location = useLocation()
  const history = useHistory()
  const tokenId = location.pathname.match(/\/([^/]+)$/)[1]

  useEffect(() => {
    if (account && tokens.length) {
      setStakeToken(tokens.find((t) => `${t.id}` === tokenId))
      getTokenBalance()
    }
  }, [tokens, account])

  useEffect(() => {
    if (account && tokens.length) {
      getAccountStake()
      const interval = !myStake.id && setInterval(getAccountStake, 2000)
      return () => {
        interval && clearInterval(interval)
      }
    }
  }, [tokens, account])

  useEffect(() => {
    if (!account) {
      setMyStake({})
    }
  }, [account])

  const getTokenBalance = () => {
    if (account && stakeToken.id) {
      if (stakeToken.name !== 'ONT' && stakeToken.name !== 'ONG') {
        const param = {
          scriptHash: stakeToken.address,
          operation: 'balanceOf',
          args: [
            {
              type: 'Address',
              value: account,
            },
          ],
        }
        client.api.smartContract.invokeRead(param).then((bl) => {
          if (bl) {
            setTokenBalance(parseInt(reverseHex(bl), 16) / (10 ** stakeToken.decimals))
          }
        })
      } else {
        getNativeTokenBalance(account, stakeToken)
      }
    }
  }

  const getNativeTokenBalance = async (account, token) => {
    const balance = await webSocketClient.getBalance(new Address(account))

    if (balance.Desc === 'SUCCESS') {
      setTokenBalance(balance.Result[token.name.toLowerCase()] / (10 ** token.decimals))
    }
  }

  function getAccountStakeByTokenId(id) {
    return client.api.smartContract.invokeWasmRead({
      scriptHash: STAKING_ADDRESS,
      operation: 'account_stake_info',
      args: [
        {
          type: 'Address',
          value: account
        },
        {
          type: 'Long',
          value: id
        }
      ]
    }).then((stakeStr) => {
      const strReader = new StringReader(stakeStr)
      return {
        id,
        balance: strReader.readUint128(),
        interest: strReader.readUint128()
      }
    })
  }

  function getAccountStake() {
    getAccountStakeByTokenId(tokenId)
    .then((stake) => {
      setMyStake(stake)
    })
    .catch((e) => {
      console.log('get account stakes', e)
    })
  }

  function handleStakeClick(action) {
    if (!account) {
      Alert.show('Please Connect Wallet First')
      return
    }
    setStakeType(action)
    setShowStakingModal(true)
  }

  async function onStake() {
    if (!account) {
      Alert.show('Please Connect Wallet First')
      return
    }
    if (stakeToken.id) {
      if (amount <= 0) {
        Alert.error('Amount should be greater than 0')
        return
      }
      if (stakeType === 'unstake' && amount > myStake.balance) {
        Alert.error('Amount should be less than your balance')
        return
      }
      try {
        const args = [
          {
            type: 'Address',
            value: account
          },
          {
            type: 'Long',
            value: stakeToken.id
          },
          {
            type: 'Long',
            value: new BigNumber(amount).times(new BigNumber(10 ** stakeToken.decimals)).integerValue(BigNumber.ROUND_DOWN).toString()
          }
        ]
        const param = {
          scriptHash: STAKING_ADDRESS,
          operation: stakeType,
          args,
          gasPrice: 2500,
          gasLimit: 30000000,
          requireIdentity: false
        }

        const stakeResult = await client.api.smartContract.invokeWasm(param)

        if (stakeResult.transaction) {
          setShowStakingModal(false)
          setModal('infoModal', {
            show: true,
            type: 'success',
            text: 'Transaction Successful',
            extraText: 'View Transaction',
            extraLink: `${TRANSACTION_BASE_URL}${stakeResult.transaction}${TRANSACTION_AFTERFIX}`
          })
        }
      } catch (e) {
        setShowStakingModal(false)
        setModal('infoModal', {
          show: true,
          type: 'error',
          text: 'Transaction Failed',
          extraText: `${e}`,
          extraLink: ''
        })
      }
    }
  }

  async function onHarvest() {
    if (!account) {
      Alert.show('Please Connect Wallet First')
      return
    }
    try {
      const args = [
        {
          type: 'Address',
          value: account
        },
        {
          type: 'Long',
          value: stakeToken.id
        }
      ]
      const param = {
        scriptHash: STAKING_ADDRESS,
        operation: 'harvest',
        args,
        gasPrice: 2500,
        gasLimit: 30000000,
        requireIdentity: false
      }

      const harvestResult = await client.api.smartContract.invokeWasm(param)

      if (harvestResult.transaction) {
        setShowStakingModal(false)
        setModal('infoModal', {
          show: true,
          type: 'success',
          text: 'Transaction Successful',
          extraText: 'View Transaction',
          extraLink: `${TRANSACTION_BASE_URL}${harvestResult.transaction}${TRANSACTION_AFTERFIX}`
        })
      }
    } catch (e) {
      setModal('infoModal', {
        show: true,
        type: 'error',
        text: 'Transaction Failed',
        extraText: `${e}`,
        extraLink: ''
      })
    }
  }

  function onNavigateToStaking() {
    history.goBack()
  }

  const maxInput = () => {
    if (!isNaN(tokenBalance)) {
      setAmount(tokenBalance)
    }
  }

  return (
    <div className="stake-container">
      <div className="stake-title">
        <div className="back-icon" onClick={() => onNavigateToStaking()} />
        Earn <span className="icon-UNX">UNX</span> by <span className={`icon-${stakeToken.name}`}>{stakeToken.name || ''}</span>
      </div>
      <div className="stake-token-detail">
        <div className={`stake-token-amount icon-${stakeToken.name}`}>{new BigNumber(myStake.balance || 0).div(10 ** (stakeToken.decimals || 0)).toString()}</div>
        <div className="stake-token-actions">
          <div className="stake-token-action" onClick={() => handleStakeClick('stake')}>Stake</div>
          <div className="stake-token-action" onClick={() => handleStakeClick('unstake')}>Unstake</div>
        </div>
      </div>
      <div className="harvest-token-detail">
        <div className="harvest-token-amount icon-UNX">{new BigNumber(myStake.interest || 0).div(10 ** 9).toString()}</div>
        <div className="harvest-token-actions">
          <div className="harvest-token-action" onClick={() => onHarvest() }>Harvest</div>
        </div>
      </div>
      { showStakingModal ? (
        <div className="modal-overlay">
          <div className="modal-wrapper">
            <div className="close-btn" onClick={() => { setShowStakingModal(false) }}></div>
            <div className="stake-wrapper">
              <div className={`icon-${stakeToken.name} token-placeholder`}></div>
              <div className="form-item">
                <div className="input-label">Amount
                  <span className="hint">Balance: {tokenBalance}</span>
                </div>
                <div className="input-wrapper">
                  <input className="input inline-input" placeholder="0.0" type="number" onChange={(event) => setAmount(event.target.value)}></input>
                  <div className="input-max-btn" onClick={() => maxInput()}>MAX</div>
                </div>
              </div>
              <div className="stake-btn" onClick={() => onStake()}>{ stakeType === 'stake' ? 'Stake' : 'Unstake'}</div>
            </div>
          </div>
        </div>
      ) : null }
    </div>
  )
}

export default StakingDetail
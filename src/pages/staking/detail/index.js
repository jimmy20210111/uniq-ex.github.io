import { client } from '@ont-dev/ontology-dapi'
import React, { useState, useEffect, useCallback } from 'react'
import { useHistory, useLocation } from "react-router-dom"
import { utils } from 'ontology-ts-sdk'
import BigNumber from 'bignumber.js'
import { useAlert } from 'react-alert'
import { useMappedState, useDispatch } from 'redux-react-hook';
import Tooltip from 'rc-tooltip';
import Input from '../../../components/input'
import { getTokenBalance, getTokenIconDom } from '../../../utils/token'
import { GOVERNANCE_ADDRESS, TRANSACTION_BASE_URL, TRANSACTION_AFTERFIX } from '../../../config'

import './index.css'

const { StringReader } = utils

const StakingDetail = (props) => {
  const [stakeToken, setStakeToken] = useState({})
  const [tokenBalance, setTokenBalance] = useState('-')
  const [tokenWeight, setTokenWeight] = useState(1)
  const [amount, setAmount] = useState('')
  const [myStake, setMyStake] = useState({})
  const [stakeType, setStakeType] = useState('stake')
  const [claimableWing, setClaimableWing] = useState(0)
  const [showStakingModal, setShowStakingModal] = useState(false)
  const { account, tokens, stakingTokens, STAKING_ADDRESS } = useMappedState((state) => ({
    account: state.wallet.account,
    tokens: state.common.tokens,
    stakingTokens: state.staking.tokens,
    STAKING_ADDRESS: state.gov.poolStat.pools.staking.address
  }))
  const dispatch = useDispatch()
  const setModal = useCallback((modalType, modalDetail) => dispatch({ type: 'SET_MODAL', modalType, modalDetail }), [])

  const Alert = useAlert()
  const location = useLocation()
  const history = useHistory()
  const tokenId = location.pathname.match(/\/([^/]+)$/)[1]

  useEffect(() => {
    if (stakingTokens.length) {
      setTokenWeight(stakingTokens.find((t) => `${t.id}` === tokenId).originWeight)
    }
  }, [stakingTokens])

  useEffect(() => {
    if (account && tokens.length) {
      const sToken = tokens.find((t) => `${t.id}` === tokenId)

      setStakeToken(sToken)
      getTokenBalance(account, sToken, setTokenBalance)
    }
  }, [tokens, account])


  useEffect(() => {
    const getClaimableWing = () => {
      if (account && stakeToken.ty === 2) {
        client.api.smartContract.invokeWasmRead({
          scriptHash: GOVERNANCE_ADDRESS,
          operation: 'claimable_wing',
          args: [
            {
              type: 'Address',
              value: account
            },
            {
              type: 'Long',
              value: stakeToken.id
            }
          ]
        }).then((resp) => {
          const strReader = new StringReader(resp)

          setClaimableWing(strReader.readUint128())
        })
      }
    }

    getClaimableWing()
    let interval = setInterval(getClaimableWing, 10000)

    return () => {
      interval && clearInterval(interval)
    }
  }, [account, stakeToken])

  useEffect(() => {
    if (account && stakeToken.id && STAKING_ADDRESS) {
      getAccountStake()
      const interval = setInterval(getAccountStake, 10000)
      return () => {
        interval && clearInterval(interval)
      }
    }
  }, [stakeToken, account, STAKING_ADDRESS])

  useEffect(() => {
    if (!account) {
      setMyStake({})
    }
  }, [account])

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
        balance: new BigNumber(strReader.readUint128() || 0).div(10 ** (stakeToken.decimals || 0)).toString(),
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
    if (stakeToken.id && STAKING_ADDRESS) {
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
          gasLimit: 60000000,
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
          // extraText: `${e}`,
          extraText: '',
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

    if (STAKING_ADDRESS) {
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
          gasLimit: 60000000,
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
          // extraText: `${e}`,
          extraText: '',
          extraLink: ''
        })
      }
    }
  }

  function onNavigateToStaking() {
    history.goBack()
  }

  const maxInput = () => {
    if (stakeType === 'stake' && !isNaN(tokenBalance)) {
      setAmount(tokenBalance)
    } else if (stakeType === 'unstake' && !isNaN(myStake.balance)) {
      setAmount(myStake.balance)
    }
  }

  return (
    <div className="stake-container">
      <div className="stake-title">
        <div className="back-icon" onClick={() => onNavigateToStaking()} />
        Earn <span className="icon-UNX">UNX</span> by
        {getTokenIconDom(stakeToken, 'inline-token-wrapper')}
        {stakeToken.name || ''}
      </div>
      <div className="stake-token-detail">
        <div className="stake-token-amount">
          {getTokenIconDom(stakeToken, 'stake-token-wrapper')}
          <div className="stake-token-amount-detail">
            <div className="stake-token-amount-label">Current Staked</div>
            <div className="stake-token-amount-info">{myStake.balance} {stakeToken.name}</div>
          </div>
        </div>
        <div className="stake-token-actions">
          { tokenWeight ? <div className="stake-token-action" onClick={() => handleStakeClick('stake')}>Stake</div> : null }
          <div className="stake-token-action" onClick={() => handleStakeClick('unstake')}>Unstake</div>
        </div>
      </div>
      <div className="harvest-token-detail">
        <div className="harvest-token-amount icon-UNX">
          <div className="harvest-token-amount-label">Rewards Available</div>
          <div className="harvest-token-amount-info">{new BigNumber(myStake.interest || 0).div(10 ** 9).toString()} UNX</div>
        </div>
        <div className="harvest-token-actions">
          <div className="harvest-token-action" onClick={() => onHarvest() }>Harvest</div>
        </div>
      </div>
      {
        stakeToken.ty === 2 ? (
          <div className="claimable-wing-detail">
            <div className="claimable-wing-amount icon-WING">{new BigNumber(claimableWing || 0).div(10 ** 9).toString()}
              <div className="claimable-wing-label">WING Earned
                <Tooltip placement="top" overlay="WING earned by ftoken will be transferred to your account when you stake or unstake">
                  <span>?</span>
                </Tooltip>
              </div>
            </div>
          </div>
        ) : null
      }
      { showStakingModal ? (
        <div className="modal-overlay">
          <div className="modal-wrapper">
            <div className="close-btn" onClick={() => { setShowStakingModal(false); setAmount(''); }}></div>
            <div className="stake-wrapper">
              <div className={`icon-${stakeToken.name} token-placeholder`}></div>
              <div className="form-item">
                <div className="input-label">Amount
                  {
                    stakeType === 'stake' ? (
                      <span className="hint">Balance: {tokenBalance}</span>
                    ) : (
                      <span className="hint">Staked: {myStake.balance}</span>
                    )
                  }
                </div>
                <div className="input-wrapper">
                  <Input placeholder="0.0" value={amount} decimals={stakeToken.decimals || 0} onChange={(amount) => setAmount(amount)} />
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
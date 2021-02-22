import { client } from '@ont-dev/ontology-dapi'
import React, { useCallback } from 'react'
import {
  // BrowserRouter as Router,
  HashRouter as Router,
  Switch,
  Route
} from 'react-router-dom'
import { useAlert } from 'react-alert'
import { useMappedState, useDispatch } from 'redux-react-hook';
import Header from './components/header'
import Modal from './components/modal'
import Transaction from './pages/transaction'
import Swap from './pages/swap'
import Pool from './pages/pool'
import AddLiquidity from './pages/pool/addLiquidity'
import RemoveLiquidity from './pages/pool/removeLiquidity'
import Staking from './pages/staking'
import StakingDetail from './pages/staking/detail'
import Token from './pages/token'
import Synth from './pages/synth'
import Overview from './pages/governance'
import { NETWORK_TYPE, READY_TABS } from './config'
import { useFetchTokens } from './hooks/useToken'
import './App.css'

export const App = () => {
  const Alert = useAlert()
  const { account, loadingToken } = useMappedState((state) => ({
    loadingToken: state.common.loadingToken,
    account: state.wallet.account
  }))
  const dispatch = useDispatch()
  const setAccount = useCallback((account) => dispatch({ type: 'SET_ACCOUNT', account }), [])

  useFetchTokens()

  async function onConnectWallet() {
    try {
      await client.api.provider.getProvider()
      const network = await client.api.network.getNetwork()
      if (network && network.type !== NETWORK_TYPE) {
        Alert.error(`Please connect to the ${NETWORK_TYPE}-Net`)
        return
      }
      const accountAddress = await client.api.asset.getAccount()
      setAccount(accountAddress)
      localStorage.setItem('account', accountAddress)
    } catch (e) {
      if (e === 'NO_PROVIDER') {
        Alert.error('Please install wallet extension first')
      }
    }
  }

  function onSignOut() {
    setAccount('')
    localStorage.setItem('account', '')
  }

  function renderLoading() {
    if (loadingToken) {
      return (
        <div className="modal-overlay">
          <div className="modal-wrapper transparent-bg">
            <div className="modal-icon-loading modal-icon"></div>
            <div className="modal-text light">Loading...</div>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <Router>
      <div className="app">
        {renderLoading()}
        {
          (account === null) && <div className="connect-wallet-overlay">
            <div className="connect-wrapper">
              <p className="connect-title">Connect Wallet</p>
              <div className="wallet-item" onClick={() => onConnectWallet()}>Cyano Wallet</div>
            </div>
          </div>
        }
        <Modal />
        <Header onSignOut={() => onSignOut()} onConnectWallet={() => onConnectWallet()} />
        <div className="main-wrapper">
          <Switch>
            {
              READY_TABS.indexOf('/') >= 0 ?
              <Route exact path="/">
                <Staking />
              </Route> : null
            }
            {
              READY_TABS.indexOf('/') >= 0 ?
              <Route exact path="/staking/:id">
                <StakingDetail />
              </Route> : null
            }
            {
              READY_TABS.indexOf('/swap') >= 0 ?
              <Route exact path="/swap">
                <Swap />
              </Route> : null
            }
            {
              READY_TABS.indexOf('/swap') >= 0 ?
              <Route exact path="/pool">
                <Pool />
              </Route> : null
            }
            {
              READY_TABS.indexOf('/swap') >= 0 ?
              <Route exact path="/pool/add">
                <AddLiquidity />
              </Route> : null
            }
            {
              READY_TABS.indexOf('/swap') >= 0 ?
              <Route exact path="/pool/remove/:id">
                <RemoveLiquidity />
              </Route> : null
            }
            {
              READY_TABS.indexOf('/trade') >= 0 ?
              <Route exact path="/trade">
                <Transaction />
              </Route> : null
            }
            {
              READY_TABS.indexOf('/governance') >= 0 ?
              <Route exact path="/governance">
                <Overview />
              </Route> : null
            }
            {
              READY_TABS.indexOf('/token') >= 0 ?
              <Route exact path="/token">
                <Token />
              </Route> : null
            }
            {
              READY_TABS.indexOf('/synth') >= 0 ?
              <Route exact path="/synth">
                <Synth />
              </Route> : null
            }
          </Switch>
        </div>
      </div>
    </Router>
  )
}

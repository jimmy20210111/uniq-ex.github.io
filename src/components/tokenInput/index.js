import React, { useState, useEffect } from 'react'
import { useMappedState } from 'redux-react-hook';
import Select, { components } from 'react-select'
import Input from '../input'
import { getTokenBalance } from '../../utils/token'

import './index.css'

const TokenInput = (props) => {
  const { value, round, tokens, defaultTokenId, inputDisabled = false, showBalance = true, withMax = true, onTokenChange, onAmountChange } = props
  const [token, setToken] = useState({})
  const [balance, setBalance] = useState('-')
  const { account } = useMappedState((state) => ({
    account: state.wallet.account
  }))

  useEffect(() => {
    if (account && showBalance && token.id) {
      getTokenBalance(account, token, setBalance)
    }
  }, [token, showBalance, account])

  const handleTokenChange = (e) => {
    if (e.value !== token.id) {
      const newToken = tokens.filter((t) => t.id === e.value)[0]

      setToken(newToken)
      typeof onTokenChange === 'function' && onTokenChange(newToken)
    }
  }

  const renderTokenSeletion = (defaultId) => {
    if (tokens.length) {
      const CustomOption = (props) => (
        <components.Option {...props}>
          <div className="option-wrapper">
            <div className={`icon-${props.label} option-icon`}></div>
            <div className="option-label">{props.label}</div>
          </div>
        </components.Option>
      )
      const SingleValue = ({ children, ...props }) => (
        <components.SingleValue {...props}>
          <div className="option-wrapper">
            <div className={`icon-${children} option-icon`}></div>
            <div className="option-label">{children}</div>
          </div>
        </components.SingleValue>
      )
      let defaultToken = defaultId ? (tokens.find((t) => t.id === defaultId) || tokens[0]) : tokens[0]

      if (!token.id) {
        setToken(defaultToken)
      }

      return (
        <Select
          className="token-select"
          defaultValue={defaultToken}
          options={tokens}
          isSearchable={false}
          components={{ Option: CustomOption, SingleValue }}
          onChange={(e) => handleTokenChange(e)}
          theme={theme => ({
            ...theme,
            borderRadius: 0,
            colors: {
              ...theme.colors,
              primary: '#2c2c2c',
            },
          })}
        />
      )
    }
  }

  const maxInput = () => {
    if (!isNaN(balance) && typeof onAmountChange === 'function') {
      onAmountChange(balance)
    }
  }

  return (
    <div className="token-input-wrapper">
      <div className="input-label">{props.label || 'Input'}
        { showBalance ? <span className="hint">Balance: {balance}</span> : null }
      </div>
      <div className="input-wrapper">
        { renderTokenSeletion(defaultTokenId) }
        <Input decimals={token.decimals} disabled={inputDisabled} value={value} round={round} onChange={(value) => onAmountChange(value)} />
        { withMax && <div className="input-max-btn" onClick={() => maxInput()}>MAX</div> }
      </div>
    </div>
  )
}

export default TokenInput
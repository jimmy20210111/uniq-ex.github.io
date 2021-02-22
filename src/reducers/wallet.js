const initState = {
  account: localStorage.getItem('account'),
  slippage: localStorage.getItem('slippage') || '0.1'
}

export const wallet = (state = initState, action) => {
  switch (action.type) {
    case 'SET_ACCOUNT':
      return { ...state, account: action.account }
    case 'SET_SLIPPAGE':
      localStorage.setItem('slippage', action.slippage)
      return { ...state, slippage: action.slippage }
    default:
      return { ...state }
  }
}
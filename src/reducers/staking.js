const initState = {
  tokens: []
}

export const staking = (state = initState, action) => {
  switch (action.type) {
    case 'SET_STAKING_TOKENS':
      return { ...state, tokens: action.tokens }
    default:
      return { ...state }
  }
}

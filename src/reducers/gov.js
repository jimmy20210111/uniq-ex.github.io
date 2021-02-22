const initState = {
  poolStat: {
    distributionInfo: {},
    pools: {
      staking: {},
      swap: {},
      dex: {},
      synth: {}
    },
    upgrade: false
  }
}

export const gov = (state = initState, action) => {
  switch (action.type) {
    case 'SET_POOL_STAT':
      return { ...state, poolStat: action.poolStat }
    default:
      return { ...state }
  }
}

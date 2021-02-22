import { combineReducers } from 'redux'
import { modal } from './modal'
import { wallet } from './wallet'
import { common } from './common'
import { gov } from './gov'
import { swap } from './swap'
import { staking } from './staking'

const reducers = combineReducers({
  modal,
  wallet,
  common,
  gov,
  swap,
  staking
})

export default reducers
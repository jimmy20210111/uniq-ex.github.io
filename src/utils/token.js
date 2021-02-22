import { client } from '@ont-dev/ontology-dapi'
import { utils } from 'ontology-ts-sdk'
import BigNumber from 'bignumber.js'
import request from './request'

const { reverseHex } = utils

export const getTokenBalance = (account, token, cb) => {
  
  if (token.name !== 'ONT' && token.name !== 'ONG') {
    const param = {
      scriptHash: token.address,
      operation: 'balanceOf',
      args: [
        {
          type: 'Address',
          value: account,
        },
      ],
    }
    let invokeMethod = client.api.smartContract.invokeRead

    if (token.ty === 2 || token.ty === 3) {
      invokeMethod = client.api.smartContract.invokeWasmRead
    }
    invokeMethod(param).then((bl) => {
      if (bl) {
        const str = reverseHex(bl).split('').reverse()
        let total = new BigNumber(0)
        
        for (let i = 0; i < str.length; i++) {
          total = total.plus(new BigNumber(16 ** i).times(parseInt(str[i], 16)))
        }
        
        cb(total.div(10 ** token.decimals).toString())
      }
    })
  } else {
    request({
      method: 'get',
      url: `/v2/addresses/${account}/native/balances`
    }).then((resp) => {
      if (resp.code === 0) {
        const targetToken = resp.result.find((t) => t.asset_name === token.name.toLowerCase())
        cb(targetToken.balance)
      }
    })
    .catch((e) => {
      console.log(e)
    })
  }
}

export const getTokenIconDom = (token, cls = '') => {
  if (token.id) {
    return (
      <div className={`token-icon-wrapper ${cls}`}>
        {
          token.ty === 3
            ? token.name.split('-').slice(1).map((tokenName) => (<div key={`${token.name}-${tokenName}`} className={`token-icon-item with-drop-shadow icon-${tokenName}`} />))
            : (<div className={`token-icon-item icon-${token.name}`} />)
        }
      </div>
    )
  }
  return null
}
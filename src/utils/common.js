export const getQueryString = (search, name) => {
  const reg = new RegExp(`(^|&)${name}=([^&]*)(&|$)`, 'i')
  const value = search.substr(1).match(reg)

  if (value != null) {
    return (value[2])
  }

  return null
}

export const getHashString = (hash, name) => {
  const reg = new RegExp(`(^|&|[/?]+)${name}=([^&]*)(&|$)`, 'i')
  const value = hash.substr(1).match(reg)

  if (value != null) {
    return (value[2])
  }

  return null
}

export function toLocaleFixed(num, n = 9) {
  const priceNum = parseFloat(n === 0 ? Math.round(num).toFixed(n) : parseFloat(num).toFixed(n)).toString()
  return priceNum && (priceNum.indexOf('.') !== -1 ? priceNum.replace(/(\d)(?=(\d{3})+\.)/g, ($0, $1) => `${$1},`) : priceNum.replace(/(?=(\B\d{3})+$)/g, ','))
}

export const formatAccount = (account = '') => {
  return `${account.substr(0, 4)}...${account.substr(-4)}`
}

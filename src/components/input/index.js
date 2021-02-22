import React, { useState, useEffect } from 'react';

const Input = (props) => {
  const { value = '', cls = '', round, disabled, decimals, inline = true, onChange } = props
  const [val, setVal] = useState('')

  useEffect(() => {
    setVal(value)
  //   if (value === '') {
  //     setVal('')
  //   } else if (`${value}`.endsWith('.')) {
  //     setVal(value)
  //   } else {
  //     if (round === 'down') {
  //       setVal(Math.floor(value * (10 ** decimals)) / (10 ** decimals))
  //     } else if (round === 'up') {
  //       setVal(Math.ceil(value * (10 ** decimals)) / (10 ** decimals))
  //     }
  //   }
  }, [value])

  const placeholder = decimals > 0 ? '0.0' : '0'
  const formatter = (v, decimals = 9) => {
    if (v === '' || v === '0') {
      return v
    } else {
      const reg = (decimals > 0) ? new RegExp(
        `^(([0-9]{0,9})|(([0]\\.\\d{0,${decimals}}|[0-9]{0,9}\\.\\d{0,${decimals}})))$`
      ) : new RegExp('^[0-9]{0,9}$')
      if (reg.test(v)) {
        return v
      } else {
        return val
      }
    }
  };
  const handleInput = (e) => {
    const formattedValue = formatter(e.target.value, decimals)

    setVal(formattedValue)
    typeof onChange === 'function' && onChange(formattedValue)
  }

  // const handleChange = (e) => {
  //   typeof onChange === 'function' && onChange(e.target.value)
  // }

  return (
    <input
      className={`input ${inline ? 'inline-input' : ''} ${cls}`}
      type="text"
      placeholder={placeholder}
      value={val}
      disabled={disabled}
      onInput={(e) => handleInput(e)}
      // onChange={(e) => handleChange(e)}
    />
  );
};

export default Input;

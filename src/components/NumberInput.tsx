import { useEffect, useState } from 'react'

type BaseNumberInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type' | 'value'>

type RequiredNumberInputProps = BaseNumberInputProps & {
  value: number
  onValueChange: (value: number) => void
  allowEmpty?: false
}

type OptionalNumberInputProps = BaseNumberInputProps & {
  value: number | undefined
  onValueChange: (value: number | undefined) => void
  allowEmpty: true
}

type NumberInputProps = RequiredNumberInputProps | OptionalNumberInputProps

function normalizeNumberText(value: string) {
  const normalized = value.replace(',', '.')
  if (normalized === '' || normalized === '.') return normalized
  if (normalized.startsWith('0.') || normalized.startsWith('-0.')) return normalized
  return normalized.replace(/^(-?)0+(?=\d)/, '$1')
}

function textFromValue(value: number | undefined) {
  if (value === undefined) return ''
  return Number.isFinite(value) ? String(value) : '0'
}

export function NumberInput(props: NumberInputProps) {
  const { value, onBlur, onFocus, allowEmpty = false, ...inputProps } = props
  const [text, setText] = useState(textFromValue(value))

  useEffect(() => {
    setText(textFromValue(value))
  }, [value])

  return (
    <input
      {...inputProps}
      type="text"
      inputMode="decimal"
      value={text}
      onFocus={(event) => {
        if (text === '0') setText('')
        onFocus?.(event)
      }}
      onChange={(event) => {
        const nextText = normalizeNumberText(event.target.value)
        setText(nextText)
        const nextValue = Number(nextText)
        if (nextText !== '' && nextText !== '.' && Number.isFinite(nextValue)) {
          props.onValueChange(nextValue)
        }
      }}
      onBlur={(event) => {
        if (text === '' || text === '.') {
          if (props.allowEmpty) {
            setText('')
            props.onValueChange(undefined)
          } else {
            setText('0')
            props.onValueChange(0)
          }
        } else {
          const nextValue = Number(text)
          if (Number.isFinite(nextValue)) {
            setText(String(nextValue))
            props.onValueChange(nextValue)
          }
        }
        onBlur?.(event)
      }}
    />
  )
}

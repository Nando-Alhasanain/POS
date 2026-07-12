import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'

export type DropdownOption = {
  value: string
  label: string
  disabled?: boolean
}

type DropdownProps = {
  value: string
  options: DropdownOption[]
  onValueChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}

export function Dropdown({ value, options, onValueChange, placeholder = 'Pilih', disabled }: DropdownProps) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectPrimitive.Trigger className="dropdown-trigger" aria-label={placeholder}>
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon className="dropdown-icon">
          <ChevronDown size={16} strokeWidth={2.4} />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content className="dropdown-content" position="popper" sideOffset={6}>
          <SelectPrimitive.Viewport className="dropdown-viewport">
            {options.map((option) => (
              <SelectPrimitive.Item className="dropdown-item" value={option.value} disabled={option.disabled} key={option.value}>
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="dropdown-item-indicator">
                  <Check size={15} strokeWidth={2.6} />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}

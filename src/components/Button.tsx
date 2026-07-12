import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}

export function Button({ children, className = '', variant = 'primary', size = 'md', ...props }: ButtonProps) {
  return (
    <button className={`btn btn-${variant} btn-${size} ${className}`} {...props}>
      {children}
    </button>
  )
}

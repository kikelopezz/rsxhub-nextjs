'use client'

interface ConfirmFormProps {
  action: (formData: FormData) => void | Promise<void>
  confirmMessage: string
  children: React.ReactNode
  className?: string
}

export function ConfirmForm({ action, confirmMessage, children, className }: ConfirmFormProps) {
  return (
    <form
      action={action}
      className={className}
      onSubmit={(e) => {
        if (!window.confirm(confirmMessage)) {
          e.preventDefault()
        }
      }}
    >
      {children}
    </form>
  )
}

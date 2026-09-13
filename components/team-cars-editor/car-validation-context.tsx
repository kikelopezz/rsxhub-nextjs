'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

type CarValidationContextValue = {
  hasErrors: boolean
  setHasErrors: (value: boolean) => void
}

const CarValidationContext = createContext<CarValidationContextValue | null>(null)

/**
 * TeamCarsEditor and SaveTeamCarsButton are rendered as siblings inside the same
 * <form> (the form itself lives in a server component), so they can't share state
 * through props. This lets the editor report its live validation state up to the
 * save button so it actually gets disabled instead of only showing a warning.
 */
export function CarValidationProvider({ children }: { children: ReactNode }) {
  const [hasErrors, setHasErrors] = useState(false)
  return (
    <CarValidationContext.Provider value={{ hasErrors, setHasErrors }}>
      {children}
    </CarValidationContext.Provider>
  )
}

export function useCarValidationContext() {
  return useContext(CarValidationContext)
}

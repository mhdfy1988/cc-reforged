import type { ComponentType, Dispatch, ReactNode, SetStateAction } from 'react'

export type WizardStepComponent<
  TData = Record<string, unknown>,
> = ComponentType<Record<string, never>>

export type WizardContextValue<
  TData = Record<string, unknown>,
> = {
  currentStepIndex: number
  totalSteps: number
  wizardData: TData
  setWizardData: Dispatch<SetStateAction<TData>>
  updateWizardData: (updates: Partial<TData>) => void
  goNext: () => void
  goBack: () => void
  goToStep: (index: number) => void
  cancel: () => void
  title?: string
  showStepCounter: boolean
}

export type WizardProviderProps<
  TData = Record<string, unknown>,
> = {
  steps: WizardStepComponent<TData>[]
  initialData?: TData
  onComplete: (data: TData) => void
  onCancel?: () => void
  children?: ReactNode
  title?: string
  showStepCounter?: boolean
}

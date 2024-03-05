export interface IScanSession {
  id: number
  name: string
  date: number
  scannings: {
    outputBlocks: {
      name: string
      value: string
      type: string
      skipOutput?: boolean
      label: string | null
      keyId?: string
      modifierKeys?: string[]
    }[]
    id: number
    repeated: boolean
    date: number
    text: string
    displayValue: string
    hasImage: boolean
  }[]
  selected: boolean
  syncedWith: string[]
}

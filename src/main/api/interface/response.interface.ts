export interface ISlip {
  discriminator: string
  valid: boolean
  data: Data
  quota: Quota
  subscription: Subscription
  isCached: boolean
  code?: number
  message?: string
}

export interface Data {
  language: any
  transRef: string
  sendingBank: string
  receivingBank: string
  transDate: string
  transTime: string
  sender: Sender
  receiver: Receiver
  amount: number
  paidLocalAmount: any
  paidLocalCurrency: any
  countryCode: string
  transFeeAmount: any
  ref1: string
  ref2: string
  ref3: any
  toMerchantId: string
}

export interface Sender {
  displayName: string
  name: string
  proxy: Proxy
  account: Account
}

export interface Proxy {
  type: any
  value: any
}

export interface Account {
  type: string
  value: string
}

export interface Receiver {
  displayName: string
  name: string
  proxy: Proxy2
  account: Account2
}

export interface Proxy2 {
  type: string
  value: string
}

export interface Account2 {
  type: string
  value: string
}

export interface Quota {
  cost: number
  usage: number
  limit: number
}

export interface Subscription {
  id: number
  postpaid: boolean
}

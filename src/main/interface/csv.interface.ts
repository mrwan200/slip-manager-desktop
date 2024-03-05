export interface ICSV {
  txn_id: string
  created_at: string
  pay_time: string
  sender_account: string
  sender_name: string
  sender_bank: string
  reciever_account: string
  reciever_name: string
  reciever_bank: string
  amount: string
  remark: string
  status: 'success' | 'failed' | 'duplicated'
}

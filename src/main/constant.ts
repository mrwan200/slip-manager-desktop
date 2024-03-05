export const SLIP_CSV_HEADERS = [
  'txn_id',
  'status',
  'created_at',
  'pay_time',
  'sender_account',
  'sender_name',
  'sender_bank',
  'reciever_account',
  'reciever_name',
  'reciever_bank',
  'amount',
  'remark'
]
export const SLIP_CONFIG_DEFAULT = {
  slip_api: {
    client_id: '',
    client_secret: '',
    postpaid: 0
  },
  promptpay: {
    mobile: ''
  }
}

export const SLIP_CSV_FILENAME = 'data.csv'
export const SLIP_CONFIG_FILENAME = 'config.yaml'

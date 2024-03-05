import axios, { AxiosResponse } from 'axios'
import { ISlip } from './interface/response.interface'

export class SlipAPI {
  private readonly apiUrl: string = 'https://suba.rdcw.co.th/v1/inquiry'
  private readonly postPaid: number = 0
  private readonly clientId: string
  private readonly clientSecret: string

  constructor(clientId: string, clientSecret: string, postPaid: number = 0) {
    this.clientId = clientId
    this.clientSecret = clientSecret
    this.postPaid = postPaid
  }

  sendSlipAPI(payload: string): Promise<AxiosResponse<ISlip>> {
    return axios.post(
      this.apiUrl,
      {
        payload,
        postpaid: this.postPaid.toString()
      },
      {
        auth: {
          username: this.clientId,
          password: this.clientSecret
        },
        validateStatus: () => true
      }
    )
  }
}

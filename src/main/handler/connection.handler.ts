import { RawData, WebSocket } from 'ws'
import { BrowserWindow } from 'electron'
import { machineIdSync } from 'node-machine-id'
import { IScanSession } from '../interface/scan.interface'

export class ConnectionHandler {
  private readonly barcodeToPcSession: Map<
    string,
    { device: string; version: string; ws: WebSocket }
  > = new Map()
  private readonly browser: BrowserWindow

  constructor(browser: BrowserWindow) {
    this.browser = browser
  }

  get sessions() {
    return Array.from(this.barcodeToPcSession, ([deviceId, data]) => ({
      id: deviceId,
      device: data.device,
      version: data.version
    }))
  }

  onWebsocketResponse(ws: WebSocket, message: RawData) {
    const parsed = JSON.parse(message.toString()) as {
      action: string
      [key: string]: string
    }

    if (parsed.action === 'ping') {
      ws.send(JSON.stringify({ action: 'pong' }))
    } else if (parsed.action === 'helo') {
      // Create new session
      if (parsed.deviceId && parsed.version && parsed.deviceName) {
        console.log(`Session ${parsed.deviceId} has started.`)
        // Store session
        this.barcodeToPcSession.set(parsed.deviceId, {
          device: parsed.deviceName,
          version: parsed.version,
          ws
        })
        // Detect if session has been closed
        ws.on('close', () => {
          console.log(`Session ${parsed.deviceId} has closed.`)
          this.barcodeToPcSession.delete(parsed.deviceId)
          this.browser.webContents.send('loadBarcodeToPcSessionHook')
        })
      }
      this.browser.webContents.send('loadBarcodeToPcSessionHook')

      ws.send(
        JSON.stringify({
          action: 'helo',
          version: parsed.version,
          outputProfiles: [
            {
              name: 'Output template 1',
              version: null,
              outputBlocks: [
                {
                  name: 'BARCODE',
                  value: 'BARCODE',
                  type: 'barcode',
                  skipOutput: false,
                  label: null,
                  enabledFormats: [],
                  filter: null,
                  errorMessage: null
                }
              ]
            }
          ],
          events: [],
          serverUUID: machineIdSync(),
          savedGeoLocations: []
        })
      )
    }

    return null
  }

  onScanWebsocketResponse(ws: WebSocket, message: RawData) {
    const parsed = JSON.parse(message.toString()) as {
      action: string
      scanSessions: IScanSession[]
      // [key: string]: string | number
    }
    if (parsed.action === 'putScanSessions') {
      if (parsed.scanSessions.length != 1) {
        return message
      }

      const scanSession = parsed.scanSessions[0]
      const scan = scanSession.scannings[0]

      if (!scan.text) return
      this.browser.webContents.send('slipValueHook', scan.text)

      ws.send(
        JSON.stringify({
          scanId: scan.id,
          scanSessionId: scanSession.id,
          outputBlocks: scan.outputBlocks,
          serverUUID: machineIdSync()
        })
      )
    }

    return null
  }

  disconnectByDeviceId(device_id: string) {
    const info = this.barcodeToPcSession.get(device_id)
    if (info) {
      info.ws.terminate()
      this.browser.webContents.send('loadBarcodeToPcSessionHook')
    }
  }
}

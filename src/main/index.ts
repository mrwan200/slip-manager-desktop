import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { address } from 'ip'
import { hostname } from 'os'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { parse as yamlParse, stringify as yamlStringify } from 'yaml'

import { Server } from 'ws'
import { IncomingMessage } from 'http'
import { parse } from 'promptparse'

import { ConnectionHandler } from './handler/connection.handler'
import { SlipAPI } from './api/index.api'
import { validateSlip } from './utils/validate.util'
import { parseCSV, stringifyCSV } from './utils/csv.util'
import { ICSV } from './interface/csv.interface'
import {
  SLIP_CONFIG_DEFAULT,
  SLIP_CONFIG_FILENAME,
  SLIP_CSV_FILENAME,
  SLIP_CSV_HEADERS
} from './constant'

const SLIP_FOLDER = join(app.getPath('home'), '.slip')

const SLIP_CSV_FULL_PATH = join(SLIP_FOLDER, SLIP_CSV_FILENAME)
const SLIP_CONFIG_YAML_PATH = join(SLIP_FOLDER, SLIP_CONFIG_FILENAME)

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Init connection
  const connection = new ConnectionHandler(mainWindow)

  // Check folder exist
  // Check folder exist
  if (!existsSync(SLIP_FOLDER)) {
    mkdirSync(SLIP_FOLDER)
  }

  // Check Slip CSV output is exist
  if (!existsSync(SLIP_CSV_FULL_PATH)) {
    // Create new CSV file
    const text = stringifyCSV<ICSV>(SLIP_CSV_HEADERS, [])
    writeFileSync(SLIP_CSV_FULL_PATH, text)
  }

  // Check Slip config is exist
  if (!existsSync(SLIP_CONFIG_YAML_PATH)) {
    // Create new CSV file
    const text = yamlStringify(SLIP_CONFIG_DEFAULT)
    writeFileSync(SLIP_CONFIG_YAML_PATH, text)
  }

  // ipc event
  ipcMain.on('getQrCodeURLReq', (event) => {
    event.sender.send(
      'getQrCodeURLRes',
      `https://app.barcodetopc.com/?${new URLSearchParams({ h: hostname(), a: address() }).toString()}`
    )
  })
  ipcMain.on('loadSlipHistoriesReq', (event) => {
    const obj = parseCSV<ICSV>(readFileSync(SLIP_CSV_FULL_PATH).toString())
    event.sender.send('loadSlipHistoriesRes', obj)
  })
  ipcMain.on('updateHistoriesSlipReq', (_, headers: string[], data: ICSV[]) => {
    const text = stringifyCSV<ICSV>(headers, data)
    writeFileSync(SLIP_CSV_FULL_PATH, text)
  })

  ipcMain.on('loadBarcodeToPcSessionReq', (event) => {
    event.sender.send('loadBarcodeToPcSessionRes', connection.sessions)
  })

  ipcMain.on('loadBarcodeToPcSessionReq', (event) => {
    event.sender.send('loadBarcodeToPcSessionRes', connection.sessions)
  })

  ipcMain.on('loadConfigDataReq', (event) => {
    // Load slip data
    const config = yamlParse(readFileSync(SLIP_CONFIG_YAML_PATH).toString())
    event.sender.send('loadConfigDataRes', config)
  })

  ipcMain.on('updateConfigDataReq', (_, field: string, data: Record<string, string>) => {
    // Load slip data
    const config = yamlParse(readFileSync(SLIP_CONFIG_YAML_PATH).toString())
    config[field] = data
    // Stringify JSON to YAML file
    const text = yamlStringify(config)
    writeFileSync(SLIP_CONFIG_YAML_PATH, text)
  })

  ipcMain.on('disconnectBarcodeToPcByDeviceId', (_, device_id) => {
    connection.disconnectByDeviceId(device_id)
  })

  ipcMain.on('validateSlipReq', async (event, val) => {
    const valid = parse(val, true)
    if (!valid) return event.sender.send('validateSlipRes', true, 'SLIP_INVALID', null)

    // Load slip data
    const { slip_api, promptpay } = yamlParse(
      readFileSync(SLIP_CONFIG_YAML_PATH).toString()
    ) as typeof SLIP_CONFIG_DEFAULT

    // Send to API server
    const api = new SlipAPI(slip_api.client_id, slip_api.client_secret, slip_api.postpaid)
    const slip = await api.sendSlipAPI(val)

    switch (slip.data.code || 0) {
      case 10001:
        return event.sender.send('validateSlipRes', true, 'SLIP_INVALID_REQ', null)
      case 10002:
        return event.sender.send('validateSlipRes', true, 'SLIP_INVALID_REQ_2', null)
      case 20001:
      case 20002:
        return event.sender.send('validateSlipRes', true, 'BANK_SERVER_ERROR', null)
      case 40000:
        console.log(slip.data.message)
        return event.sender.send('validateSlipRes', true, 'IP_NOT_ALLOWED', null)
    }

    if (slip.data.message === 'Unauthorized')
      return event.sender.send('validateSlipRes', true, 'SLIP_API_NOT_CONFIG')
    if (!slip.data.valid) return event.sender.send('validateSlipRes', true, 'SLIP_INVALID_REQ_3')

    // Get data
    const {
      discriminator,
      data: { receiver, sender, sendingBank, receivingBank, amount, transDate, transTime }
    } = slip.data
    if (
      receiver.proxy.type !== 'MSISDN' ||
      !validateSlip(receiver.proxy.value, promptpay.mobile || '')
    ) {
      return event.sender.send('validateSlipRes', true, 'BANK_DST_INVALID', null)
    }

    // Parse date
    const year = transDate.substring(0, 4)
    const month = transDate.substring(4, 6)
    const date = transDate.substring(6, 8)
    const paidTime = new Date(`${year}-${month}-${date}T${transTime}+07:00`)

    // Store into file
    // Load frist
    const obj = parseCSV<ICSV>(readFileSync(SLIP_CSV_FULL_PATH).toString())
    // Check slip duplicate
    const _payload: ICSV = {
      txn_id: discriminator,
      created_at: new Date().toISOString(),
      pay_time: paidTime.toISOString(),
      sender_account: sender.proxy.value || sender.account.value,
      sender_name: sender.displayName,
      sender_bank: sendingBank,
      reciever_account: receiver.proxy.value || receiver.account.value,
      reciever_name: receiver.displayName,
      reciever_bank: receivingBank || 'promptpay',
      amount: amount.toString(),
      remark: '',
      status: 'success'
    }
    const exist = obj.contents.find((i) => i.txn_id === discriminator)
    if (exist) return event.sender.send('validateSlipRes', true, 'SLIP_ID_DUPLICATED', _payload)
    // Push new content
    obj.contents.push(_payload)
    // Then store it
    const text = stringifyCSV<ICSV>(obj.headers, obj.contents)
    writeFileSync(SLIP_CSV_FULL_PATH, text)
    event.sender.send('validateSlipRes', false, 'SUCCESS', {
      txnId: slip.data.discriminator,
      data: slip.data.data
    })
  })

  // Enable websocket server
  let ws: Server | null = null
  if (!ws) {
    ws = new Server({ port: 57891 })
    ws.on('connection', (ws, req: IncomingMessage) => {
      console.log('ws(incoming connection)', req.socket.remoteAddress)
      ws.on('message', async (message) => {
        connection.onWebsocketResponse(ws, message)
        connection.onScanWebsocketResponse(ws, message)
      })
    })
  }

  // Check if window has been closed
  mainWindow.on('close', () => {
    if (ws) {
      ws.close()
      ws.clients.forEach((socket) => {
        socket.terminate()
      })
      // Clear websocket
      ws = null
    }
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.

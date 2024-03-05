<script setup lang="ts">
import { onMounted, ref } from 'vue'
import dayjs from 'dayjs'
import { IHistories } from './interface/histories.interface'
import { ICSV } from '../../main/interface/csv.interface'
import { SLIP_CONFIG_DEFAULT } from '../../main/constant'

import UserBank from './components/UserBank.vue'
import Loading from './components/Loading.vue'

import banks from './assets/banks.json'

import bg from './assets/bg.jpg'
import checkmark from './assets/status/accept.png'

import {
  BARCODE_TO_PC_URL_ANDROID,
  BARCODE_TO_PC_URL_IOS,
  QRCODE_URL,
  SLIP_STATUS
} from './constant'

// Page
const page = ref<'EDIT_SLIP' | 'SETTING' | 'HOME'>('HOME')
// Slip [Home]
const slipInput = ref<string>('')
const slipInputLoading = ref<boolean>(false)
const histories = ref<IHistories>({
  headers: [],
  contents: []
})
// Slip [Edit]
const slipIndex = ref<number>(-1)
const slipEditLoading = ref<boolean>(false)
const slipLoaded = ref<boolean>(false)
const slipRemark = ref<string>('')
// Setting [Barcode to PC]
const urlBarcodeToPcLoaded = ref<boolean>(false)
const urlBarcodeToPc = ref<string>('')
const urlBarcodeToPcSessions = ref<{ id: string; device: string; version: string }[]>([])
// Setting [Slip API]
const slipApiClientId = ref<string>('')
const slipApiClientSecret = ref<string>('')
const slipApiPostpaid = ref<boolean>(false)
// Setting [Promptpay]
const slipPromptPayMobile = ref<string>('')

// Slip function
const editSlip = (index: number) => {
  page.value = 'EDIT_SLIP'
  slipIndex.value = index
  // Replace data
  slipRemark.value = histories.value.contents[index].remark
}
const updateSlip = () => {
  // Loading button
  slipEditLoading.value = true
  // Update into index data
  histories.value.contents[slipIndex.value].remark = slipRemark.value

  // Send IPC to main
  window.electron.ipcRenderer.send(
    'updateHistoriesSlipReq',
    deepCloneJSON(histories.value.headers),
    deepCloneJSON(histories.value.contents)
  )
  setTimeout(() => {
    slipEditLoading.value = false
    // Load new config
    loadHistoriesSlip()
    // Reset value
    page.value = 'HOME'
    slipIndex.value = -1
    slipRemark.value = ''
  }, 50)
}

const removeSlip = (index: number) => {
  const _confirm = confirm('Are you sure want delete this slip?')
  if (!_confirm) return

  // Splice it
  histories.value.contents.splice(index, 1)

  // Send IPC to main
  window.electron.ipcRenderer.send(
    'updateHistoriesSlipReq',
    deepCloneJSON(histories.value.headers),
    deepCloneJSON(histories.value.contents)
  )
  setTimeout(() => {
    slipEditLoading.value = false
    // Load new config
    loadHistoriesSlip()
    // Reset value
    page.value = 'HOME'
    slipIndex.value = -1
    slipRemark.value = ''
  }, 1) // For cooldown store into file
}

// Electron sender
const loadHistoriesSlip = () => {
  slipLoaded.value = false
  window.electron.ipcRenderer.send('loadSlipHistoriesReq')
}
const loadBarcodeToPCSessions = () => {
  window.electron.ipcRenderer.send('loadBarcodeToPcSessionReq')
}
const loadBarcodeToPCURL = () => {
  // Reset old data
  urlBarcodeToPcLoaded.value = false
  urlBarcodeToPc.value = ''
  window.electron.ipcRenderer.send('getQrCodeURLReq')
}
const loadConfigData = () => window.electron.ipcRenderer.send('loadConfigDataReq')
const enterSlipValidate = () => {
  slipLoaded.value = false
  slipInputLoading.value = true
  window.electron.ipcRenderer.send('validateSlipReq', slipInput.value)
}
const disconnectBarcodeToPc = (deviceId: string) =>
  window.electron.ipcRenderer.send('disconnectBarcodeToPcByDeviceId', deviceId)

const updateSlipApiConfig = (method: 'slip' | 'promptpay') => {
  switch (method) {
    case 'slip':
      // Send IPC to main
      window.electron.ipcRenderer.send('updateConfigDataReq', 'slip_api', {
        client_id: slipApiClientId.value,
        client_secret: slipApiClientSecret.value,
        postpaid: Number(slipApiPostpaid.value)
      } as typeof SLIP_CONFIG_DEFAULT.slip_api)
      break
    case 'promptpay':
      // Send IPC to main
      window.electron.ipcRenderer.send('updateConfigDataReq', 'promptpay', {
        mobile: slipPromptPayMobile.value
      } as typeof SLIP_CONFIG_DEFAULT.promptpay)
      break
  }

  setTimeout(() => {
    // Reset value
    page.value = 'HOME'
    slipIndex.value = -1
    slipRemark.value = ''
  }, 1) // For cooldown store into file
}

// Electron reciever
window.electron.ipcRenderer.on('loadSlipHistoriesRes', (_, data: IHistories) => {
  histories.value = data
  slipLoaded.value = true
})
window.electron.ipcRenderer.on('getQrCodeURLRes', (_, url) => {
  urlBarcodeToPc.value = url
  urlBarcodeToPcLoaded.value = true
})
window.electron.ipcRenderer.on('loadBarcodeToPcSessionRes', (_, data) => {
  urlBarcodeToPcSessions.value = data
})
window.electron.ipcRenderer.on('validateSlipRes', (_, error, code) => {
  slipInputLoading.value = false
  if (error) alert(SLIP_STATUS[code] || `เกิดข้อผิดพลาดระบบ (${code})`)
  loadHistoriesSlip()
})
window.electron.ipcRenderer.on('loadConfigDataRes', (_, data: typeof SLIP_CONFIG_DEFAULT) => {
  // Slip API config
  slipApiClientId.value = data.slip_api.client_id
  slipApiClientSecret.value = data.slip_api.client_secret
  slipApiPostpaid.value = !!data.slip_api.postpaid
  // Promptpay config
  slipPromptPayMobile.value = data.promptpay.mobile
})

// Electron hook
window.electron.ipcRenderer.on('loadBarcodeToPcSessionHook', (_) => {
  loadBarcodeToPCSessions()
})
window.electron.ipcRenderer.on('slipValueHook', (_, value) => {
  slipInput.value = value
  if (slipInputLoading.value) return
  enterSlipValidate()
})

// Utils function
const deepCloneJSON = (data: object) => JSON.parse(JSON.stringify(data))
const parseToString = (raw: string) => Number(raw).toLocaleString()
const parseDateTime = (raw: string) => dayjs(raw).format('DD/MM/YYYY, HH:mm:ss')
const sortTable = (data: ICSV[]) =>
  data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
const getBankInfo = (code: string) => banks.find((i) => i.value === code)
const encodeURL = (raw: string) => encodeURIComponent(raw)

// Init function
onMounted(() => {
  // Body image
  document.body.style.backgroundColor = '#696969'
  document.body.style.backgroundImage = `url(${bg})`
  document.body.style.backgroundPosition = '50%'
  document.body.style.backgroundRepeat = 'no-repeat'
  document.body.style.backgroundSize = 'auto'
  document.body.style.backgroundAttachment = 'fixed'
  // Load config
  loadHistoriesSlip()
})
</script>

<template>
  <div v-if="page === 'HOME'" class="container mx-auto space-y-5 p-8">
    <div>
      <div class="flex justify-between items-center mb-5">
        <h1 class="text-4xl uppercase font-bold text-white">Slip manager</h1>
        <button
          type="button"
          class="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 mb-2 focus:outline-none"
          @click="
            () => {
              page = 'SETTING'
              loadBarcodeToPCURL()
              loadBarcodeToPCSessions()
              loadConfigData()
            }
          "
        >
          การตั้งค่า
        </button>
      </div>
      <form @submit.prevent="() => enterSlipValidate()">
        <input
          v-model="slipInput"
          type="text"
          class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5"
          placeholder="Slip Transfer ID (0004111....)"
          :disabled="slipInputLoading"
          required
        />
      </form>
      <span class="text-white"
        >Please recommend use barcode hardware or "Barcode to PC" applcation (<a
          :href="BARCODE_TO_PC_URL_ANDROID"
          target="_blank"
          class="text-sky-500 hover:text-sky-600 hover:underline no-underline duration-200"
          >Android</a
        >
        or
        <a
          :href="BARCODE_TO_PC_URL_IOS"
          target="_blank"
          class="text-sky-500 hover:text-sky-600 hover:underline no-underline duration-200"
          >IOS</a
        >)</span
      >
    </div>
    <div>
      <div class="flex space-x-2 items-center mb-3">
        <h4 class="text-left text-2xl font-bold text-white">ประวัติการสแกนสลิป</h4>
        <button
          type="button"
          class="font-medium text-sky-500 hover:underline"
          @click="() => loadHistoriesSlip()"
        >
          Load
        </button>
      </div>
      <div class="relative overflow-x-auto shadow-md sm:rounded-lg">
        <table class="w-full text-sm text-left rtl:text-right text-gray-500">
          <thead class="text-xs text-gray-700 uppercase bg-gray-50">
            <tr>
              <th scope="col" class="px-6 py-3">รายละเอียด</th>
              <th scope="col" class="px-6 py-3">ผู้โอนเงิน</th>
              <th scope="col" class="px-6 py-3">ผู้รับเงิน</th>
              <th scope="col" class="px-6 py-3">จำนวนเงิน</th>
              <th scope="col" class="px-6 py-3">การทำงาน</th>
            </tr>
          </thead>
          <tbody v-if="slipLoaded">
            <tr
              v-for="(content, key) in sortTable(histories.contents)"
              :key="key"
              class="bg-white border-b hover:bg-gray-50"
            >
              <th scope="row" class="flex items-center px-6 py-4 text-gray-900 whitespace-nowrap">
                <img class="w-10 h-10 rounded-full" :src="checkmark" alt="Jese image" />
                <div class="ps-3">
                  <div class="text-base font-semibold">{{ content.sender_account }}</div>
                  <div class="font-normal text-gray-500">
                    วันที่โอนเงิน: {{ parseDateTime(content.pay_time) }}
                  </div>
                </div>
              </th>
              <td class="px-6 py-4">
                <UserBank :code="content.sender_bank" :name="content.sender_name" />
              </td>
              <td class="px-6 py-4">
                <UserBank :code="content.reciever_bank" :name="content.reciever_name" />
              </td>
              <td class="px-6 py-4">{{ parseToString(content.amount) }} บาท</td>
              <td class="px-6 py-4 space-x-3">
                <button
                  type="button"
                  class="font-medium text-blue-600 hover:underline"
                  @click="editSlip(key)"
                >
                  แก้ไข
                </button>
                <button
                  type="button"
                  class="font-medium text-blue-600 hover:underline"
                  @click="removeSlip(key)"
                >
                  ลบ
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="!slipLoaded" class="my-5 flex justify-center">
        <Loading />
      </div>
      <footer class="flex justify-center mt-2 text-center">
        <div class="space-y-1">
          <div class="space-x-1">
            <span class="text-white">Made with 🩷 By </span>
            <a
              href="https://github.com/mrwan200"
              target="_blank"
              class="bg-gradient-to-r from-[#ad6ab4] to-[#4969da] px-3 py-1 font-medium text-white rounded-full"
              >M-307</a
            >
          </div>
          <div>
            <span class="text-white">UI/UX Design: </span>
            <a href="#" class="text-white" target="_blank">Eaktana</a>
          </div>
        </div>
      </footer>
    </div>
  </div>
  <div v-if="page === 'EDIT_SLIP'">
    <h1 class="text-3xl font-bold text-white text-left p-12">แก้ไขสลิป</h1>
    <div class="bg-slate-100 h-screen p-12 space-y-3">
      <button
        class="text-sky-500 no-underline hover:underline duration-300"
        @click="
          () => {
            page = 'HOME'
            slipRemark = ''
          }
        "
      >
        กลับไปยังหน้าหลัก
      </button>
      <h4 class="text-3xl font-bold">บัญชีผู้โอน</h4>
      <hr />
      <div>
        <label class="block mb-2 text-sm font-medium text-gray-900">ชื่อผู้โอน</label>
        <input
          type="text"
          class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg block w-[50%] p-2.5"
          readonly
          :value="histories.contents[slipIndex].sender_name"
        />
      </div>
      <div>
        <label class="block mb-2 text-sm font-medium text-gray-900">จำนวนเงิน</label>
        <input
          type="text"
          class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg block w-[50%] p-2.5"
          readonly
          :value="`${parseToString(histories.contents[slipIndex].amount)} บาท`"
        />
      </div>
      <div>
        <label class="block mb-2 text-sm font-medium text-gray-900">โอนจากธนาคาร</label>
        <input
          type="text"
          class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg block w-[50%] p-2.5"
          readonly
          :value="getBankInfo(histories.contents[slipIndex].sender_bank)?.title"
        />
      </div>
      <div>
        <label class="block mb-2 text-sm font-medium text-gray-900">หมายเหตุ</label>
        <textarea
          v-model="slipRemark"
          rows="3"
          class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg block w-[50%] p-2.5"
          required
        />
      </div>
      <div>
        <button
          type="button"
          class="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2 focus:outline-none"
          :disabled="slipEditLoading"
          @click="updateSlip()"
        >
          บันทึกข้อมูล
        </button>
      </div>
    </div>
  </div>
  <div v-if="page === 'SETTING'">
    <h1 class="text-3xl font-bold text-white text-left p-12">การตั้งค่าระบบ</h1>
    <div class="bg-slate-100 h-full p-12 space-y-3">
      <button
        class="text-sky-500 no-underline hover:underline duration-300"
        @click="
          () => {
            page = 'HOME'
            slipRemark = ''
          }
        "
      >
        กลับไปยังหน้าหลัก
      </button>
      <div>
        <label class="block text-lg font-medium text-gray-900">ตั้งค่า SLIP API </label>
        <div class="mb-3">
          <span>สมัครและซื้อ Package ได้ที่ </span>
          <a
            href="https://slip.rdcw.co.th"
            target="_blank"
            class="text-sky-500 no-underline hover:underline duration-300"
            >Slip verify | RDCW</a
          >
        </div>
        <div class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-900">Client ID</label>
            <input
              v-model="slipApiClientId"
              type="text"
              class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg block w-[50%] p-2.5"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-900">Client Secret</label>
            <input
              v-model="slipApiClientSecret"
              type="password"
              class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg block w-[50%] p-2.5"
            />
          </div>
          <div class="flex items-center mb-4">
            <input
              v-model="slipApiPostpaid"
              type="checkbox"
              class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
            <label for="default-checkbox" class="ms-2 text-sm font-medium text-gray-900"
              >เป็น Partner ของร้านค้า</label
            >
          </div>
          <div>
            <button
              type="button"
              class="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2 focus:outline-none"
              @click="updateSlipApiConfig('slip')"
            >
              บันทึกข้อมูล
            </button>
          </div>
        </div>
      </div>
      <div>
        <label class="block text-lg font-medium text-gray-900">ตั้งค่าพร้อมเพย์ (Promptpay) </label>
        <div class="space-y-3 mt-3">
          <div>
            <label class="block text-sm font-medium text-gray-900">เบอร์โทรพร้อมเพย์</label>
            <input
              v-model="slipPromptPayMobile"
              type="text"
              class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg block w-[50%] p-2.5"
            />
          </div>
          <div>
            <button
              type="button"
              class="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2 focus:outline-none"
              @click="updateSlipApiConfig('promptpay')"
            >
              บันทึกข้อมูล
            </button>
          </div>
        </div>
      </div>
      <div>
        <label class="block mb-2 text-lg font-medium text-gray-900"
          >เชื่อมต่อกับ Barcode to PC App</label
        >
        <div v-if="urlBarcodeToPcLoaded" class="my-5 space-y-3">
          <img :src="`${QRCODE_URL}${encodeURL(urlBarcodeToPc)}`" />
        </div>
        <Loading v-else />
      </div>
      <div>
        <label class="block mb-2 text-lg font-medium text-gray-900"
          >รายการเชื่อมต่อ Barcode to PC</label
        >
        <div class="relative overflow-x-auto w-[50%]">
          <table class="w-full text-sm text-left rtl:text-right text-gray-500">
            <thead class="text-xs text-gray-700 uppercase bg-gray-50">
              <tr>
                <th scope="col" class="px-6 py-3">Device</th>
                <th scope="col" class="px-6 py-3">Version</th>
                <th scope="col" class="px-6 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(data, idx) in urlBarcodeToPcSessions"
                :key="idx"
                class="bg-white border-b"
              >
                <th scope="row" class="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                  {{ data.device }}
                </th>
                <td class="px-6 py-4">{{ data.version }}</td>
                <td class="px-6 py-4">
                  <button
                    type="button"
                    class="text-white bg-red-700 hover:bg-red-800 focus:ring-4 focus:ring-red-300 font-medium rounded-lg text-sm px-5 py-2.5 mb-2 focus:outline-none"
                    @click="() => disconnectBarcodeToPc(data.id)"
                  >
                    Disconnect
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

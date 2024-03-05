<script lang="ts" setup>
import { ref } from 'vue'
import banks from '../assets/banks.json'

const props = defineProps<{ code: string; name: string }>()

const bankCode = ref('')
const bankName = ref('')
// Get banks code
const bankInfo = banks.find((i) => i.value === props.code)
if (bankInfo) {
  bankCode.value = bankInfo.type
  bankName.value = bankInfo.title
} else if (props.code === 'promptpay') {
  bankCode.value = 'promptpay'
  bankName.value = 'พร้อมเพย์'
}
</script>

<template>
  <div class="flex items-center space-x-3">
    <img
      :src="`https://veryr2.m307.dev/bank/${bankCode}.png`"
      class="w-[32px] h-[32px] rounded-xl"
    />
    <div>
      <h6>{{ props.name }}</h6>
      <h6>ธนาคาร{{ bankName }}</h6>
    </div>
  </div>
</template>

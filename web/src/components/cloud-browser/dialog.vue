<template>
  <el-dialog
    v-model="dialogVisible"
    align-center
    center
    draggable
    :width="width + 40"
    :fullscreen="fullscreen || !dialogVisible"
    :close-on-press-escape="false"
    :close-on-click-modal="false"
    :show-close="false"
  >
    <template #header>
      <div class="w-full flex items-center justify-between">
        <div class="text-sm text-gray-500">
          <span>云浏览器</span>
          <span>ID: {{ sessionId ?? "--" }}</span>
        </div>
        <div>
          <el-button plain type="primary" @click="handleFullscreen">全屏</el-button>
          <el-button plain type="warning" @click="close">关闭</el-button>
          <el-button type="primary" :loading="confirmLoading" @click="handleConfirm">确定</el-button>
        </div>
      </div>
    </template>
    <div class="flex flex-col justify-center items-center">
      <iframe :src="url" :style="{ width: `${width}px`, height: `${height}px` }" frameborder="0" />
    </div>
  </el-dialog>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import { client } from "@/utils/client";

const dialogVisible = ref(false);
const fullscreen = ref(false);
const confirmLoading = ref(false);
const height = window.innerHeight * 0.75;
const width = height * (1376 / 768);

const defaultUrl = `http://localhost:9221/vnc.html#password=password&autoconnect=true&reconnect=true&reconnect_delay=5000&resize=scale&view_only=false`;
const url = ref(defaultUrl);

const handleFullscreen = () => {
  fullscreen.value = !fullscreen.value;
};

const openView = async () => {
  dialogVisible.value = true;
  url.value = defaultUrl;
};

const sessionId = ref<string>();
const renewTimer = ref<NodeJS.Timeout>();
const ticket = ref<string>();
const confirmCb = ref<() => Promise<boolean>>();
const open = async (id: string, fn: () => Promise<boolean>) => {
  dialogVisible.value = true;
  sessionId.value = id;
  confirmCb.value = fn;

  const res = await client.browser.session.$post({
    json: {
      sessionId: id,
      args: [],
    },
  });
  if (res.ok) {
    const payload = await res.json();
    ticket.value = payload.ticket;
    url.value = payload.url;
    renewTimer.value = setInterval(async () => {
      if (!dialogVisible.value && renewTimer.value) {
        clearInterval(renewTimer.value!);
        renewTimer.value = undefined;
        return;
      }
      await client.browser.session.renew.$post({
        json: {
          ticket: ticket.value!,
          sessionId: sessionId.value!,
        },
      });
    }, 10000);
  }
};

const handleConfirm = async () => {
  confirmLoading.value = true;
  if (confirmCb.value) {
    const result = await confirmCb.value();
    if (result) {
      close();
    }
  }
  confirmLoading.value = false;
};

const close = () => {
  dialogVisible.value = false;
  clearInterval(renewTimer.value!);

  if (sessionId.value && ticket.value) {
    client.browser.session.close.$post({
      json: {
        sessionId: sessionId.value!,
        ticket: ticket.value!,
      },
    });
  }
};

defineExpose({
  open,
  openView,
  close,
});
</script>

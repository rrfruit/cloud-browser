<template>
  <div class="space-y-4">
    <div class="flex items-center gap-2">
      <span class="text-gray-500 text-sm">共 {{ list.length }} 个活跃会话</span>
      <el-button @click="fetchSessions" :loading="loading">刷新</el-button>
      <el-button type="primary" @click="showCreateDialog = true">新建会话</el-button>
    </div>

    <el-table :data="list" v-loading="loading" border>
      <el-table-column label="会话 ID" prop="id" min-width="200" />
      <el-table-column label="过期时间" min-width="200">
        <template #default="{ row }">
          <span>{{ formatDate(row.expiresAt) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="剩余时间" min-width="140">
        <template #default="{ row }">
          <el-tag :type="getTagType(row.expiresAt)" size="small">
            {{ formatRemaining(row.expiresAt) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100" align="center">
        <template #default="{ row }">
          <el-popconfirm title="确认关闭该会话？" @confirm="handleClose(row.id)">
            <template #reference>
              <el-button type="danger" size="small" :loading="closingId === row.id">关闭</el-button>
            </template>
          </el-popconfirm>
        </template>
      </el-table-column>
    </el-table>
  </div>

  <CreateSessionDialog v-model="showCreateDialog" @success="fetchSessions" />
</template>

<script lang="ts" setup>
import { ref, onMounted } from "vue";
import { client } from "@/utils/client";
import CreateSessionDialog from "./CreateSessionDialog.vue";

type SessionInfo = { id: string; expiresAt: number };

const list = ref<SessionInfo[]>([]);
const loading = ref(false);
const closingId = ref<string | null>(null);

const showCreateDialog = ref(false);

async function fetchSessions() {
  loading.value = true;
  try {
    const res = await client.browser.sessions.$get();
    if (res.ok) {
      list.value = await res.json();
    }
  } finally {
    loading.value = false;
  }
}

async function handleClose(id: string) {
  closingId.value = id;
  try {
    const res = await client.browser.session[":id"].close.$post({ param: { id } });
    if (res.ok) {
      ElMessage.success("会话已关闭");
      await fetchSessions();
    }
  } finally {
    closingId.value = null;
  }
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleString("zh-CN");
}

function formatRemaining(expiresAt: number) {
  const diff = expiresAt - Date.now();
  if (diff <= 0) return "已过期";
  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  if (mins > 0) return `${mins} 分 ${secs} 秒`;
  return `${secs} 秒`;
}

function getTagType(expiresAt: number): "danger" | "warning" | "success" {
  const diff = expiresAt - Date.now();
  if (diff <= 0) return "danger";
  if (diff < 5 * 60 * 1000) return "warning";
  return "success";
}

onMounted(fetchSessions);
</script>

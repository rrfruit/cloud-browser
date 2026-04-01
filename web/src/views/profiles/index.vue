<template>
  <div class="space-y-4">
    <div class="flex items-center gap-2">
      <span class="text-gray-500 text-sm">共 {{ list.length }} 个 Profiles</span>
      <el-button @click="fetchProfiles" :loading="loading">刷新</el-button>
      <el-button type="primary" @click="showCreateDialog = true">启动 Profile 会话</el-button>
    </div>

    <el-table :data="list" v-loading="loading" border>
      <el-table-column label="Profile ID" prop="id" min-width="200">
        <template #default="{ row }">
          <el-button link type="primary" @click="openProfileView(row.id)">{{ row.id }}</el-button>
        </template>
      </el-table-column>
      <el-table-column label="状态" min-width="120">
        <template #default="{ row }">
          <el-tag :type="row.active ? 'success' : 'info'" size="small">
            {{ row.active ? "活跃" : "未启动" }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="过期时间" min-width="200">
        <template #default="{ row }">
          <span>{{ row.expiresAt ? formatDate(row.expiresAt) : "-" }}</span>
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

  <CreateProfileDialog v-model="showCreateDialog" @success="fetchProfiles" />
  <CloudBrowserDialog ref="cloudBrowserDialogRef" />
</template>

<script lang="ts" setup>
import { ref, onMounted } from "vue";
import { client } from "@/utils/client";
import CreateProfileDialog from "./CreateProfileDialog.vue";
import CloudBrowserDialog from "@/components/cloud-browser/dialog.vue";

type ProfileInfo = { id: string; active: boolean; expiresAt: number | null };

const list = ref<ProfileInfo[]>([]);
const loading = ref(false);
const closingId = ref<string | null>(null);

const showCreateDialog = ref(false);
const cloudBrowserDialogRef = ref<InstanceType<typeof CloudBrowserDialog> | null>(null);

function openProfileView(id: string) {
  cloudBrowserDialogRef.value?.open(id, async () => true);
}

async function fetchProfiles() {
  loading.value = true;
  try {
    const res = await client.browser.profiles.$get();
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
      await fetchProfiles();
    }
  } finally {
    closingId.value = null;
  }
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleString("zh-CN");
}

function formatRemaining(expiresAt: number | null) {
  if (!expiresAt) return "-";
  const diff = expiresAt - Date.now();
  if (diff <= 0) return "已过期";
  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  if (mins > 0) return `${mins} 分 ${secs} 秒`;
  return `${secs} 秒`;
}

function getTagType(expiresAt: number | null): "danger" | "warning" | "success" | "info" {
  if (!expiresAt) return "info";
  const diff = expiresAt - Date.now();
  if (diff <= 0) return "danger";
  if (diff < 5 * 60 * 1000) return "warning";
  return "success";
}

onMounted(fetchProfiles);
</script>

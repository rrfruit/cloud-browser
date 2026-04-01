<template>
  <div class="space-y-4">
    <!-- 工具栏 -->
    <div class="flex items-center gap-2 flex-wrap">
      <el-input
        v-model="searchKeyword"
        placeholder="搜索名称 / 邮箱"
        clearable
        class="w-56"
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      />
      <el-select v-model="filterActive" placeholder="全部状态" clearable class="w-32" @change="handleSearch">
        <el-option label="已启用" value="true" />
        <el-option label="已禁用" value="false" />
      </el-select>
      <el-button type="primary" @click="handleSearch">搜索</el-button>
      <el-button @click="fetchList">刷新</el-button>
      <el-button type="primary" @click="handleCreate">新增账号</el-button>
    </div>

    <!-- 表格 -->
    <el-table :data="list" v-loading="loading" border>
      <el-table-column type="selection" width="55" />
      <el-table-column label="名称" prop="name" min-width="120">
        <template #default="{ row }">
          <span class="cursor-pointer text-blue-500 hover:text-blue-700 hover:underline" @click="handleDetail(row)">{{
            row.name || "--"
          }}</span>
        </template>
      </el-table-column>
      <el-table-column label="邮箱" prop="email" min-width="180">
        <template #default="{ row }">
          <span class="cursor-pointer text-blue-500 hover:text-blue-700 hover:underline" @click="handleDetail(row)">{{
            row.email || "--"
          }}</span>
        </template>
      </el-table-column>
      <el-table-column label="付费等级" prop="userPaygateTier" width="100">
        <template #default="{ row }">
          <el-tag v-if="row.userPaygateTier" type="warning" size="small">{{ row.userPaygateTier }}</el-tag>
          <span v-else class="text-gray-400">--</span>
        </template>
      </el-table-column>
      <el-table-column label="Credits" width="110" align="right">
        <template #default="{ row }">
          <span class="mr-1">{{ row.credits }}</span>
          <el-tooltip content="刷新 Credits" placement="top">
            <el-icon
              class="cursor-pointer text-gray-400 hover:text-blue-500 align-middle"
              :class="{ 'animate-spin': refreshingCreditsIds[row.id] }"
              @click="handleRefreshCredits(row)"
            >
              <i class="i-solar:refresh-circle-linear"></i>
            </el-icon>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column label="使用次数" prop="useCount" width="90" align="right" />
      <el-table-column label="图片" width="70" align="center">
        <template #default="{ row }">
          <el-icon :class="row.imageEnabled ? 'text-green-500' : 'text-gray-300'">
            <i-ep-circle-check v-if="row.imageEnabled" />
            <i-ep-circle-close v-else />
          </el-icon>
        </template>
      </el-table-column>
      <el-table-column label="视频" width="70" align="center">
        <template #default="{ row }">
          <el-icon :class="row.videoEnabled ? 'text-green-500' : 'text-gray-300'">
            <i-ep-circle-check v-if="row.videoEnabled" />
            <i-ep-circle-close v-else />
          </el-icon>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="row.isActive ? 'success' : 'danger'" size="small">
            {{ row.isActive ? "启用" : "禁用" }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="登录状态" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="row.isLogin ? 'success' : 'danger'" size="small">
            {{ row.isLogin ? "已登录" : "未登录" }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="最后使用" min-width="160">
        <template #default="{ row }">{{ formatDate(row.lastUsedAt) }}</template>
      </el-table-column>
      <el-table-column label="创建时间" min-width="160">
        <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="130" fixed="right" align="center">
        <template #default="{ row }">
          <div class="inline-flex items-center gap-0 flex-nowrap">
            <el-button type="primary" link @click="handleEdit(row)">编辑</el-button>
            <el-dropdown trigger="click" @command="(cmd: RowActionCommand) => handleRowAction(cmd, row)">
              <el-button type="primary" link class="!ml-0" :loading="getItemLoading(row.id)">
                更多
                <el-icon class="ml-0.5 align-middle text-xs"><i-ep-arrow-down /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="cloudBrowser">云浏览器</el-dropdown-item>
                  <el-dropdown-item command="refreshSt" :disabled="!!refreshingStIds[row.id]">刷新 ST</el-dropdown-item>
                  <el-dropdown-item command="refreshAT" :disabled="!!refreshingIds[row.id]">刷新 AT</el-dropdown-item>
                  <el-dropdown-item command="forceRelease" :disabled="!!forceReleasingIds[row.id]">
                    强制释放锁
                  </el-dropdown-item>
                  <el-dropdown-item command="toggle" :disabled="!!togglingIds[row.id]">
                    {{ row.isActive ? "禁用" : "启用" }}
                  </el-dropdown-item>
                  <el-dropdown-item command="delete" divided :disabled="!!deletingIds[row.id]" class="text-red-500">
                    删除
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <div class="flex justify-end">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        @change="fetchList"
      />
    </div>

    <FlowAccountCreateDialog ref="formDialogRef" />
    <FlowAccountDetailDialog ref="detailDialogRef" />
    <CloudBrowserDialog ref="cloudBrowserDialogRef" />
  </div>
</template>

<script setup lang="ts">
import { client } from "@/utils/client";
import type { InferResponseType } from "hono/client";
import { onMounted, ref } from "vue";
import FlowAccountCreateDialog from "./components/FlowAccountCreateDialog.vue";
import FlowAccountDetailDialog from "./components/FlowAccountDetailDialog.vue";
import CloudBrowserDialog from "@/components/cloud-browser/dialog.vue";

type AccountListResponse = InferResponseType<(typeof client)["flow-accounts"]["$get"], 200>;
type AccountItem = AccountListResponse["data"]["list"][number];

type RowActionCommand = "cloudBrowser" | "refreshSt" | "refreshAT" | "forceRelease" | "toggle" | "delete";

const list = ref<AccountItem[]>([]);
const loading = ref(false);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const searchKeyword = ref("");
const filterActive = ref<string | undefined>(undefined);
const deletingIds = ref<Record<number, boolean>>({});
const togglingIds = ref<Record<number, boolean>>({});
const refreshingIds = ref<Record<string, boolean>>({});
const refreshingStIds = ref<Record<string, boolean>>({});
const refreshingCreditsIds = ref<Record<string, boolean>>({});
const forceReleasingIds = ref<Record<string, boolean>>({});

const formDialogRef = ref<{
  open: (data?: AccountItem) => Promise<boolean>;
} | null>(null);
const detailDialogRef = ref<{ open: (data: AccountItem) => void } | null>(null);

const getItemLoading = (id: string) => {
  return (
    refreshingIds[id] ||
    refreshingStIds[id] ||
    refreshingCreditsIds[id] ||
    forceReleasingIds[id] ||
    togglingIds[id] ||
    deletingIds[id] ||
    false
  );
};

const formatDate = (value?: string | null) => {
  if (!value) return "--";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "--" : date.toLocaleString();
};

const fetchList = async () => {
  loading.value = true;
  const res = await client["flow-accounts"].$get({
    query: {
      page: String(page.value),
      pageSize: String(pageSize.value),
      keyword: searchKeyword.value || undefined,
      isActive: filterActive.value as "true" | "false" | undefined,
    },
  });
  if (res.ok) {
    const payload = await res.json();
    list.value = payload.data.list;
    total.value = payload.data.total;
  }
  loading.value = false;
};

const handleSearch = () => {
  page.value = 1;
  fetchList();
};

const handleCreate = async () => {
  const ok = await formDialogRef.value?.open();
  if (ok) fetchList();
};

const handleEdit = async (row: AccountItem) => {
  const ok = await formDialogRef.value?.open(row);
  if (ok) fetchList();
};

const handleDetail = (row: AccountItem) => {
  detailDialogRef.value?.open(row);
};

const handleToggle = async (row: AccountItem) => {
  togglingIds.value[row.id] = true;
  const res = await client["flow-accounts"][":id"]["toggle"].$patch({
    param: { id: String(row.id) },
  });
  togglingIds.value[row.id] = false;
  if (res.ok) {
    ElMessage.success(row.isActive ? "已禁用" : "已启用");
    fetchList();
  }
};

const handleRefreshCredits = async (row: AccountItem) => {
  refreshingCreditsIds.value[row.id] = true;
  const res = await client["flow-accounts"][":id"]["refreshCredits"].$post({
    param: { id: row.id },
  });
  refreshingCreditsIds.value[row.id] = false;
  const payload = await res.json();
  if (res.ok) {
    ElMessage.success("刷新 Credits 成功");
    fetchList();
  } else {
    ElMessage.error(("message" in payload ? payload.message : null) || "刷新 Credits 失败");
  }
};

const handleRefreshSt = async (row: AccountItem) => {
  refreshingStIds.value[row.id] = true;
  const res = await client["flow-accounts"][":id"]["refreshSt"].$post({
    param: { id: row.id },
  });
  refreshingStIds.value[row.id] = false;
  const payload = await res.json();
  if (res.ok) {
    ElMessage.success("刷新 ST 成功");
    fetchList();
  } else {
    ElMessage.error(("message" in payload ? payload.message : null) || "刷新 ST 失败");
  }
};

const handleRefreshAT = async (row: AccountItem) => {
  refreshingIds.value[row.id] = true;
  const res = await client["flow-accounts"][":id"]["refreshAccessToken"].$post({
    param: { id: row.id },
  });
  refreshingIds.value[row.id] = false;
  const payload = await res.json();
  if (res.ok) {
    ElMessage.success("刷新 AT 成功");
    fetchList();
  } else {
    ElMessage.error(("message" in payload ? payload.message : null) || "刷新 AT 失败");
  }
};

const handleForceRelease = async (row: AccountItem) => {
  forceReleasingIds.value[row.id] = true;
  const res = await client["flow-accounts"][":id"]["forceRelease"].$post({
    param: { id: row.id },
  });
  forceReleasingIds.value[row.id] = false;
  const payload = await res.json();
  if (res.ok) {
    ElMessage.success("已强制释放锁并清理浏览器");
    fetchList();
  } else {
    ElMessage.error(("message" in payload ? payload.message : null) || "强制释放失败");
  }
};

const handleDelete = async (row: AccountItem) => {
  deletingIds.value[row.id] = true;
  const res = await client["flow-accounts"][":id"].$delete({
    param: { id: String(row.id) },
  });
  deletingIds.value[row.id] = false;
  if (res.ok) {
    ElMessage.success("删除成功");
    fetchList();
  }
};

const handleRowAction = async (command: RowActionCommand, row: AccountItem) => {
  switch (command) {
    case "cloudBrowser":
      handleOpenCloudBrowser(row);
      break;
    case "refreshSt":
      void handleRefreshSt(row);
      break;
    case "refreshAT":
      void handleRefreshAT(row);
      break;
    case "forceRelease":
      try {
        await ElMessageBox.confirm("将强制删除 Redis 锁并关闭浏览器、删除 session，是否继续？", "强制释放锁", {
          type: "warning",
          confirmButtonText: "继续",
          cancelButtonText: "取消",
        });
        await handleForceRelease(row);
      } catch {
        /* 取消 */
      }
      break;
    case "toggle":
      void handleToggle(row);
      break;
    case "delete":
      try {
        await ElMessageBox.confirm("确认删除该账号？删除后无法恢复。", "删除账号", {
          type: "warning",
          confirmButtonText: "删除",
          cancelButtonText: "取消",
          confirmButtonClass: "el-button--danger",
        });
        await handleDelete(row);
      } catch {
        /* 取消 */
      }
      break;
  }
};

const cloudBrowserDialogRef = ref<InstanceType<typeof CloudBrowserDialog> | null>(null);
const handleOpenCloudBrowser = (row: AccountItem) => {
  void cloudBrowserDialogRef.value?.open(String(row.id), async () => true);
};

onMounted(() => {
  fetchList();
});
</script>

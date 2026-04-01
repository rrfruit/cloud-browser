<template>
  <header class="h-14 shrink-0 bg-white border-b border-slate-100 px-4 flex justify-between items-center">
    <div class="flex items-center gap-3">
      <el-button
        circle
        text
        size="small"
        @click="appStore.toggleSidebar()"
        :title="appStore.isSidebarCollapsed ? '展开菜单' : '收起菜单'"
      >
        <i class="i-solar:sidebar-minimalistic-linear text-lg" />
      </el-button>
      <div class="text-base font-bold">
        {{ activeMenu?.title }}
      </div>
    </div>
    <div class="flex items-center gap-2">
      <el-button @click="onOpenCloudBrowser">
        <i class="i-solar:clipboard-heart-bold" />
      </el-button>
      <el-dropdown>
        <div class="flex items-center gap-2">
          <i class="i-solar:user-circle-bold size-6" />
          <span>{{ userStore.user.username }}</span>
        </div>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item @click="onChangePassword">修改密码</el-dropdown-item>
            <el-dropdown-item @click="onLogout">退出登录</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
    <ChangePasswordDialog ref="changePasswordDialogRef" />
    <CloudBrowserDialog ref="cloudBrowserDialogRef" />
  </header>
</template>

<script setup lang="ts">
import ChangePasswordDialog from "@/components/ChangePasswordDialog.vue";
import CloudBrowserDialog from "@/components/cloud-browser/dialog.vue";
import { useActiveMenu } from "@/hooks/useActiveMenu";
import { useAppStore } from "@/stores/app";
import { useUserStore } from "@/stores/user";
import { useRouter } from "vue-router";
import { ref } from "vue";
import { removeToken } from "@/utils/token";

const userStore = useUserStore();
const appStore = useAppStore();
const router = useRouter();
const { activeMenu } = useActiveMenu();

const changePasswordDialogRef = ref<{ open: () => Promise<boolean> } | null>(null);

const onChangePassword = () => {
  changePasswordDialogRef.value?.open();
};

const cloudBrowserDialogRef = ref<InstanceType<typeof CloudBrowserDialog> | null>(null);

const onOpenCloudBrowser = () => {
  cloudBrowserDialogRef.value?.openView();
};

const onLogout = () => {
  removeToken();
  router.push("/login");
};
</script>

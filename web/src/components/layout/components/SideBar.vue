<template>
  <el-menu router :default-active="activePath" class="h-full w-[220px] shrink-0" :collapse="isCollapsed">
    <el-menu-item v-for="item in menuItems" :key="item.path" :index="item.path" class="text-base! gap-2">
      <i :class="item.icon" />
      <span>{{ item.title }}</span>
    </el-menu-item>
  </el-menu>
</template>

<script lang="ts" setup>
import { useActiveMenu } from "@/hooks/useActiveMenu";
import { useAppStore } from "@/stores/app";
import { computed } from "vue";

const appStore = useAppStore();
const { menuItems, activePath } = useActiveMenu();
const isCollapsed = computed(() => appStore.isSidebarCollapsed);
</script>

<style scoped lang="scss">
:deep(.el-menu-item) {
  &.is-active {
    background-color: rgba(64, 158, 255, 0.1) !important;
  }

  &:hover {
    color: var(--el-color-primary) !important;
    background-color: inherit;
  }
}
</style>

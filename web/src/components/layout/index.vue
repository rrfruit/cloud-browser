<template>
  <el-container class="h-screen">
    <Sidebar />
    <el-container class="flex-col!">
      <NavBar />
      <el-main class="flex-1">
        <AppMain />
      </el-main>
    </el-container>
  </el-container>
</template>

<script lang="ts" setup>
import { useUserStore } from "@/stores/user";
import { onMounted } from "vue";
import AppMain from "./components/AppMain.vue";
import NavBar from "./components/NavBar.vue";
import Sidebar from "./components/SideBar.vue";

const userStore = useUserStore();
onMounted(() => {
  userStore.getProfile();
});
</script>

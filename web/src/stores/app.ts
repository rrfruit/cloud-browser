import { defineStore } from "pinia";
import { ref } from "vue";
import { isMobile } from "@/utils";

export const useAppStore = defineStore("app", () => {
  const isSidebarCollapsed = ref(isMobile());

  const toggleSidebar = () => {
    isSidebarCollapsed.value = !isSidebarCollapsed.value;
  };

  const setSidebarCollapsed = (value: boolean) => {
    isSidebarCollapsed.value = value;
  };

  return {
    isSidebarCollapsed,
    toggleSidebar,
    setSidebarCollapsed,
  };
});

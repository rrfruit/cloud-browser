import { dashboardRoutes } from "@/router";
import { computed } from "vue";
import { useRoute } from "vue-router";

const normalizePath = (path: string) => (path.startsWith("/") ? path : `/${path}`);

/**
 * Get active menu info based on current route and dashboard routes definition.
 */
export function useActiveMenu() {
  const route = useRoute();

  const menuItems = computed(() =>
    dashboardRoutes
      .filter((v) => v.meta?.hidden !== true)
      .map((item) => {
        const path = normalizePath(item.path);
        return {
          path,
          title: (item.meta?.title as string) ?? String(item.name ?? path),
          icon: item.meta?.icon as string | undefined,
        };
      }),
  );

  const activeMenu = computed(() => {
    const current = route.path;
    return menuItems.value.find((item) => current === item.path || current.startsWith(`${item.path}/`));
  });

  const activePath = computed(() => activeMenu.value?.path ?? normalizePath(route.path));

  return {
    menuItems,
    activeMenu,
    activePath,
  };
}

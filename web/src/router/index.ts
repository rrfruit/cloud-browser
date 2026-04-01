import { type RouteRecordRaw, createRouter, createWebHashHistory } from "vue-router";
import { getToken } from "../utils/token";

const dashboardRoutes: RouteRecordRaw[] = [
  {
    path: "/",
    redirect: "/browser",
    meta: { hidden: true },
  },
  {
    path: "browser",
    name: "browser",
    meta: {
      title: "云浏览器",
      icon: "i-solar:user-circle-bold",
    },
    component: () => import("../views/browser/index.vue"),
  },
  
];

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "layout",
    component: () => import("../components/layout/index.vue"),
    children: dashboardRoutes,
  },
];

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes,
});

const isAuthenticated = () => Boolean(getToken());

router.beforeEach((to) => {
  const isPublic = Boolean(to.meta?.public);
  if (isPublic && isAuthenticated()) {
    return { path: "/" };
  }
  if (!isPublic && !isAuthenticated()) {
    return { path: "/login", query: { redirect: to.fullPath } };
  }
  return true;
});

export { dashboardRoutes };

export default router;

// Vue Router configuration

import {
  createRouter,
  createWebHistory,
  type RouteLocationNormalized,
} from "vue-router";

// Lazy-load views for code splitting
const NextView = () => import("./views/NextView.vue");
const TasksView = () => import("./views/TasksView.vue");
const ProjectsView = () => import("./views/ProjectsView.vue");
const HistoryView = () => import("./views/HistoryView.vue");
const SettingsView = () => import("./views/SettingsView.vue");

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "next",
      component: NextView,
      meta: { title: "Next" },
    },
    {
      path: "/tasks",
      name: "tasks",
      component: TasksView,
      meta: { title: "Tasks" },
    },
    {
      path: "/projects",
      name: "projects",
      component: ProjectsView,
      meta: { title: "Projects" },
    },
    {
      path: "/history",
      name: "history",
      component: HistoryView,
      meta: { title: "History" },
    },
    {
      path: "/settings",
      name: "settings",
      component: SettingsView,
      meta: { title: "Settings" },
    },
    // Redirect unknown routes to Next
    {
      path: "/:pathMatch(.*)*",
      redirect: "/",
    },
  ],
});

// Update document title on navigation
router.afterEach((to: RouteLocationNormalized) => {
  const title = to.meta?.title as string | undefined;
  document.title = title ? `${title} | Todos` : "Todos | mklv.tech";
});

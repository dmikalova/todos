// Vue application entry point

import { createApp } from "vue";
import App from "./App.vue";
import { router } from "./router.ts";

// Import Tailwind CSS
import "./styles/input.css";

const app = createApp(App);

// Install plugins
app.use(router);

// Mount application
app.mount("#app");

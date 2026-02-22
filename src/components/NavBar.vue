<script setup lang="ts">
import { Disclosure, DisclosureButton, DisclosurePanel } from "@headlessui/vue";
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();

const navigation = [
  { name: "Next", href: "/", icon: "⚡" },
  { name: "Tasks", href: "/tasks", icon: "📋" },
  { name: "Projects", href: "/projects", icon: "📁" },
  { name: "History", href: "/history", icon: "📜" },
  { name: "Settings", href: "/settings", icon: "⚙️" },
];

const currentPath = computed(() => route.path);

function isActive(href: string): boolean {
  if (href === "/") {
    return currentPath.value === "/";
  }
  return currentPath.value.startsWith(href);
}
</script>

<template>
  <Disclosure as="nav" class="bg-white shadow" v-slot="{ open }">
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div class="flex h-16 justify-between">
        <!-- Logo and desktop nav -->
        <div class="flex">
          <div class="flex flex-shrink-0 items-center">
            <router-link to="/" class="text-xl font-bold text-lime-600">
              Todos
            </router-link>
          </div>
          <div class="hidden sm:ml-6 sm:flex sm:space-x-8">
            <router-link
              v-for="item in navigation"
              :key="item.name"
              :to="item.href"
              :class="[
                isActive(item.href)
                  ? 'border-lime-500 text-gray-900'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
                'inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium',
              ]"
            >
              <span class="mr-2">{{ item.icon }}</span>
              {{ item.name }}
            </router-link>
          </div>
        </div>

        <!-- Mobile menu button -->
        <div class="-mr-2 flex items-center sm:hidden">
          <DisclosureButton
            class="inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-lime-500"
          >
            <span class="sr-only">Open main menu</span>
            <svg
              v-if="!open"
              class="block h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            </svg>
            <svg
              v-else
              class="block h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </DisclosureButton>
        </div>
      </div>
    </div>

    <!-- Mobile menu -->
    <DisclosurePanel class="sm:hidden">
      <div class="space-y-1 pb-3 pt-2">
        <router-link
          v-for="item in navigation"
          :key="item.name"
          :to="item.href"
          :class="[
            isActive(item.href)
              ? 'border-lime-500 bg-lime-50 text-lime-700'
              : 'border-transparent text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800',
            'block border-l-4 py-2 pl-3 pr-4 text-base font-medium',
          ]"
        >
          <span class="mr-2">{{ item.icon }}</span>
          {{ item.name }}
        </router-link>
      </div>
    </DisclosurePanel>
  </Disclosure>
</template>

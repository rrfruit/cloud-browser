import { client } from "@/utils/client";
import { defineStore } from "pinia";
import { ref } from "vue";

export const useUserStore = defineStore("user", () => {
  const user = ref({
    username: "",
  });

  const getProfile = async () => {
    const res = await client.auth.profile.$get();
    if (res.ok) {
      const data = await res.json();
      user.value = {
        username: data.username,
      };
    }
  };

  return { user, getProfile };
});

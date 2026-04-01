<template>
  <el-dialog
    :model-value="modelValue"
    title="启动 Profile 会话"
    width="400px"
    @update:model-value="onVisibleChange"
    @closed="resetForm"
  >
    <el-form :model="form" label-width="80px">
      <el-form-item label="Profile ID">
        <el-input v-model="form.sessionId" placeholder="请输入 Profile ID" clearable />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="close">取消</el-button>
      <el-button type="primary" :loading="creating" @click="submit">启动</el-button>
    </template>
  </el-dialog>
</template>

<script lang="ts" setup>
import { ref, watch } from "vue";
import { client } from "@/utils/client";

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  success: [];
}>();

const form = ref({ sessionId: "" });
const creating = ref(false);

function resetForm() {
  form.value.sessionId = "";
}

function close() {
  emit("update:modelValue", false);
}

function onVisibleChange(v: boolean) {
  emit("update:modelValue", v);
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) resetForm();
  },
);

async function submit() {
  const profileId = form.value.sessionId.trim();
  if (!profileId) {
    ElMessage.warning("请输入 Profile ID");
    return;
  }
  creating.value = true;
  try {
    const res = await client.browser.session.$post({
      json: { sessionId: profileId },
    });
    if (res.ok) {
      ElMessage.success("Profile 会话已启动");
      close();
      emit("success");
      return;
    }

    const errorText = (await res.text()).toLowerCase();
    const isProfileLocked = errorText.includes("profile appears to be in use");
    if (!isProfileLocked) {
      return;
    }

    try {
      await ElMessageBox.confirm(
        "检测到 Profile 被锁定，是否先解除占用再重试？",
        "Profile 占用提示",
        {
          type: "warning",
          confirmButtonText: "解除并重试",
          cancelButtonText: "取消",
        },
      );
    } catch {
      return;
    }

    const unlockRes = await client.browser.profile[":id"].unlock.$post({
      param: { id: profileId },
    });
    if (!unlockRes.ok) {
      return;
    }

    const retryRes = await client.browser.session.$post({
      json: { sessionId: profileId },
    });
    if (retryRes.ok) {
      ElMessage.success("Profile 会话已启动");
      close();
      emit("success");
    }
  } finally {
    creating.value = false;
  }
}
</script>

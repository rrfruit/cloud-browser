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
  if (!form.value.sessionId.trim()) {
    ElMessage.warning("请输入 Profile ID");
    return;
  }
  creating.value = true;
  try {
    const res = await client.browser.session.$post({
      json: { sessionId: form.value.sessionId.trim() },
    });
    if (res.ok) {
      ElMessage.success("Profile 会话已启动");
      close();
      emit("success");
    }
  } finally {
    creating.value = false;
  }
}
</script>

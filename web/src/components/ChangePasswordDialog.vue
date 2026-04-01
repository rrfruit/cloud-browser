<template>
  <el-dialog v-model="visible" title="修改密码" width="420px" @close="handleCancel" @closed="resetForm">
    <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
      <el-form-item label="旧密码" prop="oldPassword">
        <el-input
          v-model="form.oldPassword"
          type="password"
          placeholder="请输入旧密码"
          show-password
          autocomplete="off"
        />
      </el-form-item>
      <el-form-item label="新密码" prop="newPassword">
        <el-input
          v-model="form.newPassword"
          type="password"
          placeholder="请输入新密码"
          show-password
          autocomplete="off"
        />
      </el-form-item>
      <el-form-item label="确认新密码" prop="confirmPassword">
        <el-input
          v-model="form.confirmPassword"
          type="password"
          placeholder="请再次输入新密码"
          show-password
          autocomplete="off"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="handleCancel">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleConfirm"> 确定 </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { client } from "@/utils/client";
import type { FormInstance, FormRules } from "element-plus";
import { reactive, ref } from "vue";

const visible = ref(false);
const submitting = ref(false);
const formRef = ref<FormInstance>();
const resolver = ref<((value: boolean) => void) | null>(null);

const form = reactive({
  oldPassword: "",
  newPassword: "",
  confirmPassword: "",
});

const validateConfirm = (_rule: unknown, value: string, callback: (e?: Error) => void) => {
  if (value !== form.newPassword) {
    callback(new Error("两次输入的新密码不一致"));
  } else {
    callback();
  }
};

const rules: FormRules = {
  oldPassword: [{ required: true, message: "请输入旧密码", trigger: "blur" }],
  newPassword: [{ required: true, message: "请输入新密码", trigger: "blur" }],
  confirmPassword: [
    { required: true, message: "请再次输入新密码", trigger: "blur" },
    { validator: validateConfirm, trigger: "blur" },
  ],
};

const resetForm = () => {
  form.oldPassword = "";
  form.newPassword = "";
  form.confirmPassword = "";
  formRef.value?.clearValidate();
};

const handleConfirm = async () => {
  if (!formRef.value) return;
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;

  // submitting.value = true;
  // const res = await client.auth["change-password"].$post({
  //   json: {
  //     oldPassword: form.oldPassword,
  //     newPassword: form.newPassword,
  //   },
  // });
  // submitting.value = false;

  // if (res.ok) {
  //   ElMessage.success("密码修改成功");
  //   const next = resolver.value;
  //   resolver.value = null;
  //   visible.value = false;
  //   next?.(true);
  // }
};

const handleCancel = () => {
  const next = resolver.value;
  resolver.value = null;
  visible.value = false;
  next?.(false);
};

const open = () => {
  resetForm();
  visible.value = true;
  return new Promise<boolean>((resolve) => {
    resolver.value = resolve;
  });
};

defineExpose({ open });
</script>

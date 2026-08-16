import { ResetPasswordForm } from "@/components/reset-password-form";
import { redirect } from "next/navigation";

type ResetPasswordSearchParams = Promise<{
  code?: string | string[];
  error?: string | string[];
  error_description?: string | string[];
  sb_flow_id?: string | string[];
}>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: ResetPasswordSearchParams;
}) {
  const params = await searchParams;
  const code = firstValue(params.code);

  if (code) {
    const callbackParams = new URLSearchParams({
      code,
      next: "/auth/reset-password",
    });
    const flowId = firstValue(params.sb_flow_id);
    if (flowId) callbackParams.set("sb_flow_id", flowId);
    redirect(`/auth/callback?${callbackParams.toString()}`);
  }

  const authError = firstValue(params.error);
  const description = firstValue(params.error_description);
  const initialError = authError
    ? description || "密码重置链接无效或已经过期，请重新申请。"
    : "";

  return <ResetPasswordForm initialError={initialError} />;
}

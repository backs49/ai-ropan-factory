"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}

export async function signup(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const displayName = formData.get("displayName") as string;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
    },
  });

  if (error) {
    return { error: error.message };
  }

  // 이메일 확인이 활성화된 환경: 세션이 없으므로 안내 페이지로
  if (!data.session) {
    redirect("/check-email");
  }

  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(formData: FormData): Promise<{
  error?: string;
  success?: boolean;
}> {
  const supabase = await createClient();
  const email = (formData.get("email") as string)?.trim();

  if (!email) return { error: "이메일을 입력해주세요." };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  let baseUrl: string;
  if (siteUrl) {
    baseUrl = siteUrl.replace(/\/$/, "");
  } else {
    const headersList = await headers();
    const origin = headersList.get("origin") ?? headersList.get("host") ?? "";
    baseUrl = origin.startsWith("http") ? origin : `https://${origin}`;
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${baseUrl}/reset-password`,
  });

  if (error) return { error: error.message };
  return { success: true };
}

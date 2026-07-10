import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MailCheck } from "lucide-react";

export default function CheckEmailPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <MailCheck className="mx-auto h-10 w-10 text-primary" />
          <CardTitle>이메일을 확인해주세요</CardTitle>
          <CardDescription>
            가입 확인 메일을 보냈습니다. 메일의 링크를 눌러 가입을 완료해주세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            확인 후 <Link href="/login" className="underline">로그인</Link>해주세요.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

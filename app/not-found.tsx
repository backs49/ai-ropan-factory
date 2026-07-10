import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center px-4">
      <h2 className="text-2xl font-bold">페이지를 찾을 수 없습니다</h2>
      <p className="text-muted-foreground text-sm">주소가 잘못됐거나 삭제된 페이지입니다.</p>
      <Button render={<Link href="/" />}>홈으로</Button>
    </div>
  );
}

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sparkles,
  BookOpen,
  Users,
  FileText,
  Palette,
  Zap,
  Shield,
  ArrowRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";

const features = [
  {
    icon: BookOpen,
    title: "3막 구조 & 아웃라인",
    description: "전체 스토리 구조와 에피소드별 아웃라인을 자동 설계",
  },
  {
    icon: Users,
    title: "캐릭터 시트 8명",
    description: "외모, 성격, 비밀, 관계도까지 상세한 캐릭터 설정",
  },
  {
    icon: FileText,
    title: "1화 완성본",
    description: "4,000~5,000자의 프로급 한국어 웹소설 문체",
  },
  {
    icon: Palette,
    title: "표지 프롬프트 & SEO",
    description: "Midjourney/Flux 프롬프트 + 검색 최적화 제목",
  },
];

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold">AI 로판 팩토리</span>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <Button render={<Link href="/dashboard" />}>
                대시보드
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <>
                <Button variant="ghost" render={<Link href="/login" />}>로그인</Button>
                <Button render={<Link href="/signup" />}>무료로 시작</Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 py-20 text-center">
        <Badge variant="secondary" className="mb-4">
          <Sparkles className="mr-1 h-3 w-3" />
          AI 기반 웹소설 기획 도구
        </Badge>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
          장르와 키워드만 입력하면
          <br />
          <span className="text-primary">완성된 웹소설 기획</span>이 나옵니다
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          3막 구조, 캐릭터 시트, 1화 완성본, 표지 프롬프트까지.
          AI가 카카오페이지·네이버 시리즈 수준의 웹소설 기획을 자동으로 생성합니다.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Button size="lg" render={<Link href={user ? "/generate" : "/signup"} />}>
            <Sparkles className="mr-2 h-5 w-5" />
            무료로 시작하기
          </Button>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          회원가입 후 평생 3회 무료 생성
        </p>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center text-2xl font-bold mb-10">
          한 번의 생성으로 받는 결과물
        </h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <Card key={f.title}>
              <CardContent className="pt-6">
                <f.icon className="h-10 w-10 text-primary mb-4" />
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Trust */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-8 sm:grid-cols-3">
          <div className="text-center">
            <Zap className="mx-auto h-8 w-8 text-primary mb-2" />
            <h3 className="font-semibold">실시간 스트리밍</h3>
            <p className="text-sm text-muted-foreground mt-1">생성 과정을 실시간으로 확인</p>
          </div>
          <div className="text-center">
            <Shield className="mx-auto h-8 w-8 text-primary mb-2" />
            <h3 className="font-semibold">100% 저작권 귀속</h3>
            <p className="text-sm text-muted-foreground mt-1">생성된 콘텐츠는 모두 작가님 것</p>
          </div>
          <div className="text-center">
            <BookOpen className="mx-auto h-8 w-8 text-primary mb-2" />
            <h3 className="font-semibold">플랫폼 투고 최적화</h3>
            <p className="text-sm text-muted-foreground mt-1">카카오페이지/시리즈 트렌드 반영</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="mx-auto max-w-6xl px-4 text-center text-sm text-muted-foreground">
          <p>AI 로판 팩토리 &copy; 2026. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

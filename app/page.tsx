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
    title: "에피소드 연재",
    description: "1화부터 N화까지 이어서 생성. 직접 편집도 가능",
  },
  {
    icon: Palette,
    title: "표지 프롬프트 & SEO",
    description: "Midjourney/Flux 프롬프트 + 검색 최적화 제목",
  },
];

const steps = [
  { num: "1", title: "장르 & 키워드 입력", desc: "로판, 빙의물, 회귀물 등 장르와 핵심 키워드를 선택" },
  { num: "2", title: "AI 자동 생성", desc: "아웃라인, 캐릭터, 1화, 표지 프롬프트가 실시간 생성" },
  { num: "3", title: "이어서 연재", desc: "2화, 3화... 버튼 하나로 다음 화를 계속 생성" },
  { num: "4", title: "편집 & 다운로드", desc: "마음에 드는 부분은 그대로, 아쉬운 부분은 직접 편집 후 다운로드" },
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

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-16 border-t">
        <h2 className="text-center text-2xl font-bold mb-10">
          어떻게 사용하나요?
        </h2>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <div key={s.num} className="text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                {s.num}
              </div>
              <h3 className="font-semibold mb-1">{s.title}</h3>
              <p className="text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-16 border-t">
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

      {/* Pricing */}
      <section className="mx-auto max-w-6xl px-4 py-16 border-t">
        <h2 className="text-center text-2xl font-bold mb-2">요금제</h2>
        <p className="text-center text-muted-foreground mb-10">
          무료로 시작하고, 필요할 때 업그레이드하세요
        </p>
        <div className="grid gap-6 sm:grid-cols-2 max-w-2xl mx-auto">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h3 className="font-bold text-lg">Free</h3>
              <div>
                <span className="text-3xl font-bold">0</span>
                <span className="text-muted-foreground">원</span>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>- 프로젝트 최대 3개</li>
                <li>- 프로젝트당 3화까지</li>
                <li>- AI 모델 조합 사용</li>
              </ul>
              <Button variant="outline" className="w-full" render={<Link href={user ? "/dashboard" : "/signup"} />}>
                무료로 시작
              </Button>
            </CardContent>
          </Card>
          <Card className="border-2 border-primary/50">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg">Pro</h3>
                <Badge variant="secondary">추천</Badge>
              </div>
              <div>
                <span className="text-3xl font-bold">9,900</span>
                <span className="text-muted-foreground">원/월</span>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>- 프로젝트 무제한</li>
                <li>- 에피소드 무제한</li>
                <li>- 최신 고급 AI 모델 전용</li>
              </ul>
              <Button className="w-full" render={<Link href={user ? "/pricing" : "/signup"} />}>
                Pro 시작하기
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-4 py-20 text-center border-t">
        <h2 className="text-2xl font-bold mb-4">지금 바로 시작하세요</h2>
        <p className="text-muted-foreground mb-6">
          장르와 키워드만 입력하면 AI가 웹소설 기획을 완성합니다
        </p>
        <Button size="lg" render={<Link href={user ? "/generate" : "/signup"} />}>
          <Sparkles className="mr-2 h-5 w-5" />
          무료로 시작하기
        </Button>
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

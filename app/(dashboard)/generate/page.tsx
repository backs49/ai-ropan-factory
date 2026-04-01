import { GenerationForm } from "@/components/generate/generation-form";

export default async function GeneratePage({
  searchParams,
}: {
  searchParams: Promise<{ variation_of?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">새 작품 생성</h1>
        <p className="text-muted-foreground">
          장르, 키워드, 분위기를 선택하면 AI가 웹소설 기획을 자동으로 생성합니다.
        </p>
      </div>
      <GenerationForm variationOf={params.variation_of} />
    </div>
  );
}

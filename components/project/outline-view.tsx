import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { OutlineData } from "@/types";

export function OutlineView({ outline }: { outline: OutlineData }) {
  const acts = [
    { label: "1막 - 도입", data: outline.act1 },
    { label: "2막 - 전개", data: outline.act2 },
    { label: "3막 - 결말", data: outline.act3 },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-bold">{outline.title}</h2>
        <p className="text-muted-foreground">{outline.logline}</p>
      </div>
      {acts.map((act) => (
        <Card key={act.label}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{act.label}</CardTitle>
            <p className="text-sm text-muted-foreground">{act.data.summary}</p>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-80">
              <div className="space-y-3">
                {act.data.episodes.map((ep) => (
                  <div key={ep.episode_number} className="flex gap-3 rounded-lg bg-muted/50 p-3">
                    <Badge variant="outline" className="shrink-0 h-6 w-10 justify-center">
                      {ep.episode_number}
                    </Badge>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{ep.title}</p>
                      <p className="text-xs text-muted-foreground">{ep.summary}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      ))}
      {outline.arcs && outline.arcs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">이후 전개 (아크 요약)</CardTitle>
            <p className="text-sm text-muted-foreground">
              31화부터는 10화 단위 아크로 설계됩니다. 각 화의 상세 내용은 에피소드 생성 시 아크
              흐름에 맞춰 작성됩니다.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {outline.arcs.map((arc) => (
                <div key={arc.range} className="flex gap-3 rounded-lg bg-muted/50 p-3">
                  <Badge variant="outline" className="shrink-0 h-6 px-2 justify-center">
                    {arc.range}화
                  </Badge>
                  <p className="text-xs text-muted-foreground">{arc.summary}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

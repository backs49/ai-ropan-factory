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
    </div>
  );
}

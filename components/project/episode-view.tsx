import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function EpisodeView({ content }: { content: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">1화 완성본</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="prose prose-invert max-w-none">
          {content.split("\n\n").map((paragraph, i) => (
            <p key={i} className="text-sm leading-relaxed mb-4">{paragraph}</p>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { CharacterData } from "@/types";

export function CharacterSheet({ character }: { character: CharacterData }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{character.name}</CardTitle>
          <Badge variant="secondary">{character.role}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{character.age}</p>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <p className="font-medium text-muted-foreground mb-1">외모</p>
          <p>{character.appearance}</p>
        </div>
        <Separator />
        <div>
          <p className="font-medium text-muted-foreground mb-1">성격</p>
          <p>{character.personality}</p>
        </div>
        <Separator />
        <div>
          <p className="font-medium text-muted-foreground mb-1">비밀</p>
          <p>{character.secret}</p>
        </div>
        <Separator />
        <div>
          <p className="font-medium text-muted-foreground mb-1">동기</p>
          <p>{character.motivation}</p>
        </div>
        {character.relationships.length > 0 && (
          <>
            <Separator />
            <div>
              <p className="font-medium text-muted-foreground mb-1">관계</p>
              <div className="space-y-1">
                {character.relationships.map((rel, i) => (
                  <p key={i}>
                    <span className="font-medium">{rel.character}</span>{" — "}{rel.relationship}
                  </p>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download } from "lucide-react";
import type { Project, Episode } from "@/types";

function generateMarkdown(project: Project, episodes: Episode[] = []): string {
  let md = `# ${(project.outline as any)?.title || project.title || "제목 없음"}\n\n`;
  md += `> ${(project.outline as any)?.logline || ""}\n\n`;
  md += `**장르:** ${project.genre} | **분위기:** ${project.mood} | **타겟:** ${project.target_age}\n\n`;
  md += `**키워드:** ${project.keywords.join(", ")}\n\n`;
  md += `---\n\n`;

  if (project.outline) {
    const outline = project.outline as any;
    md += `## 3막 구조\n\n`;
    const acts = [
      { label: "1막", data: outline.act1 },
      { label: "2막", data: outline.act2 },
      { label: "3막", data: outline.act3 },
    ];
    for (const act of acts) {
      md += `### ${act.label}\n\n${act.data.summary}\n\n`;
      for (const ep of act.data.episodes) {
        md += `- **${ep.episode_number}화: ${ep.title}** — ${ep.summary}\n`;
      }
      md += `\n`;
    }
  }

  if (project.characters) {
    md += `## 캐릭터\n\n`;
    for (const char of project.characters as any[]) {
      md += `### ${char.name} (${char.role})\n\n`;
      md += `- **나이:** ${char.age}\n`;
      md += `- **외모:** ${char.appearance}\n`;
      md += `- **성격:** ${char.personality}\n`;
      md += `- **비밀:** ${char.secret}\n`;
      md += `- **동기:** ${char.motivation}\n\n`;
    }
  }

  if (episodes.length > 0) {
    md += `## 에피소드\n\n`;
    for (const ep of episodes) {
      if (ep.status === "completed" && ep.content) {
        md += `### ${ep.episode_number}화\n\n${ep.content}\n\n---\n\n`;
      }
    }
  } else if (project.first_episode) {
    md += `## 1화 완성본\n\n${project.first_episode}\n\n`;
  }

  if (project.seo) {
    const seo = project.seo as any;
    md += `## SEO\n\n`;
    md += `**제목 후보:** ${seo.titles?.join(" | ") || ""}\n\n`;
    md += `**해시태그:** ${seo.hashtags?.join(" ") || ""}\n\n`;
  }

  if (project.cover_prompts) {
    md += `## 표지 프롬프트\n\n`;
    for (const cp of project.cover_prompts as any[]) {
      md += `### ${cp.style}\n\n`;
      md += `**Prompt:** ${cp.prompt}\n\n`;
      md += `**Negative:** ${cp.negative_prompt}\n\n`;
    }
  }

  md += `\n---\n*생성된 모든 콘텐츠의 저작권은 사용자에게 100% 귀속됩니다.*\n`;
  return md;
}

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function DownloadButton({ project, episodes = [] }: { project: Project; episodes?: Episode[] }) {
  const title = (project.outline as any)?.title || project.title || "작품";

  function handleDownloadMD() {
    const md = generateMarkdown(project, episodes);
    downloadFile(md, `${title}.md`, "text/markdown;charset=utf-8");
  }

  function handleDownloadTXT() {
    const md = generateMarkdown(project, episodes);
    const txt = md
      .replace(/^#{1,3}\s/gm, "")
      .replace(/\*\*/g, "")
      .replace(/^>\s/gm, "")
      .replace(/^-\s/gm, "  - ");
    downloadFile(txt, `${title}.txt`, "text/plain;charset=utf-8");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" />}>
        <Download className="mr-2 h-4 w-4" />
        다운로드
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={handleDownloadMD}>Markdown (.md)</DropdownMenuItem>
        <DropdownMenuItem onClick={handleDownloadTXT}>텍스트 (.txt)</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

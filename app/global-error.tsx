"use client";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="ko">
      <body style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <h2>문제가 발생했습니다</h2>
          <button onClick={reset} style={{ marginTop: 16, padding: "8px 16px", cursor: "pointer" }}>
            다시 시도
          </button>
        </div>
      </body>
    </html>
  );
}

export const metadata = { title: "개인정보처리방침 - AI 로판 팩토리" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 space-y-6">
      <h1 className="text-2xl font-bold">개인정보처리방침</h1>
      <p className="text-sm text-muted-foreground">시행일: 2026년 7월 10일</p>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">제1조 (목적)</h2>
        <p className="text-sm leading-relaxed">
          AI 로판 팩토리(이하 &ldquo;회사&rdquo;)는 이용자의 개인정보를 중요시하며, 「개인정보 보호법」 등
          관계 법령을 준수합니다. 회사는 본 개인정보처리방침을 통해 이용자가 제공하는 개인정보가 어떠한
          목적과 방식으로 수집·이용·보관·위탁되는지 알려드립니다.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">제2조 (수집하는 개인정보 항목)</h2>
        <p className="text-sm leading-relaxed">회사는 서비스 제공을 위해 다음과 같은 개인정보를 수집합니다.</p>
        <ul className="list-disc pl-5 text-sm leading-relaxed space-y-1">
          <li>회원가입 시: 이메일 주소, 닉네임(필명), 비밀번호(암호화 저장)</li>
          <li>Pro 요금제 결제 시: 결제 기록(결제일시, 결제금액, 결제수단 정보 일부, 빌링키), 카드사·Toss Payments를 통해 처리되는 결제 관련 정보</li>
          <li>서비스 이용 과정에서 자동 수집: 접속 로그, 서비스 이용 기록(생성 요청 내역)</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">제3조 (개인정보의 수집 및 이용 목적)</h2>
        <ul className="list-disc pl-5 text-sm leading-relaxed space-y-1">
          <li>회원 가입 및 관리, 본인 확인, 계정 인증</li>
          <li>AI 웹소설 기획·생성 서비스 제공 및 이용 이력 관리</li>
          <li>Pro 요금제 결제, 정기결제(자동결제) 처리, 결제 관련 문의 및 분쟁 해결</li>
          <li>서비스 개선, 오류 대응, 고객 문의 응대</li>
          <li>관계 법령에 따른 의무 이행(전자상거래 기록 보관 등)</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">제4조 (개인정보의 보유 및 이용 기간)</h2>
        <p className="text-sm leading-relaxed">
          ① 회사는 원칙적으로 이용자가 서비스 내 설정 메뉴를 통해 회원 탈퇴를 요청하는 즉시 해당 이용자의
          개인정보 및 생성 콘텐츠를 지체 없이 삭제합니다.
        </p>
        <p className="text-sm leading-relaxed">
          ② 다만, 「전자상거래 등에서의 소비자보호에 관한 법률」 등 관계 법령에 따라 보존이 필요한 다음의
          정보는 아래 명시한 기간 동안 별도로 보관한 후 파기합니다.
        </p>
        <ul className="list-disc pl-5 text-sm leading-relaxed space-y-1">
          <li>계약 또는 청약철회 등에 관한 기록: 5년 (전자상거래 등에서의 소비자보호에 관한 법률)</li>
          <li>대금결제 및 재화 등의 공급에 관한 기록: 5년 (전자상거래 등에서의 소비자보호에 관한 법률)</li>
          <li>소비자의 불만 또는 분쟁처리에 관한 기록: 3년 (전자상거래 등에서의 소비자보호에 관한 법률)</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">제5조 (개인정보 처리의 위탁)</h2>
        <p className="text-sm leading-relaxed">
          회사는 원활한 서비스 제공을 위해 다음과 같이 개인정보 처리 업무를 외부 업체에 위탁하고 있으며,
          위탁계약 체결 시 관계 법령에 따라 개인정보가 안전하게 관리되도록 필요한 사항을 규정합니다.
        </p>
        <ul className="list-disc pl-5 text-sm leading-relaxed space-y-1">
          <li>Supabase (Supabase, Inc.): 회원정보, 프로젝트·에피소드 데이터 등 서비스 데이터베이스 보관 및 인증 처리</li>
          <li>Toss Payments (비바리퍼블리카): Pro 요금제 결제 및 정기결제(빌링키) 처리</li>
          <li>Google(Gemini), xAI(Grok), Anthropic(Claude): 이용자가 입력한 생성 요청 텍스트(장르, 키워드, 아웃라인 등)를 AI 결과물 생성을 위해 각 AI 제공사의 API로 전송</li>
        </ul>
        <p className="text-sm leading-relaxed">
          위 AI 제공사로 전송되는 정보는 콘텐츠 생성 요청 처리 목적으로만 사용되며, 각 제공사의 자체
          개인정보처리방침 및 API 이용약관이 함께 적용될 수 있습니다.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">제6조 (이용자의 권리와 행사 방법)</h2>
        <p className="text-sm leading-relaxed">
          ① 이용자는 언제든지 자신의 개인정보를 열람, 정정할 수 있으며 서비스 내 설정 메뉴에서 직접 처리할
          수 있습니다.
        </p>
        <p className="text-sm leading-relaxed">
          ② 이용자는 서비스 내 설정 메뉴의 회원 탈퇴 기능을 통해 자신의 개인정보 삭제(처리정지)를 요청할 수
          있으며, 요청 즉시 처리됩니다(단, 제4조 제2항의 법정 보관 정보는 예외).
        </p>
        <p className="text-sm leading-relaxed">
          ③ 이용자는 개인정보 처리와 관련한 문의, 이의제기, 삭제 요청 등을 아래 &ldquo;문의처&rdquo;를 통해
          요청할 수 있습니다.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">제7조 (개인정보의 안전성 확보 조치)</h2>
        <p className="text-sm leading-relaxed">
          회사는 비밀번호 암호화 저장, 접근 권한 관리, 전송 구간 암호화(TLS) 등 개인정보를 안전하게 관리하기
          위한 기술적·관리적 조치를 취하고 있습니다.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">제8조 (문의처)</h2>
        <p className="text-sm leading-relaxed">
          개인정보 처리에 관한 문의, 불만 처리, 피해 구제 등은 서비스 내 고객센터 또는 아래 이메일을 통해
          접수하실 수 있습니다.
        </p>
        {/* TODO: 서비스 오픈 전 실제 문의 이메일로 교체 필요 */}
        <p className="text-sm leading-relaxed">이메일: support@ai-ropan-factory.com</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">부칙</h2>
        <p className="text-sm leading-relaxed">이 개인정보처리방침은 2026년 7월 10일부터 시행합니다.</p>
      </section>
    </div>
  );
}

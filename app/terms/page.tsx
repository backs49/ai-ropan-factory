export const metadata = { title: "이용약관 - AI 로판 팩토리" };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 space-y-6">
      <h1 className="text-2xl font-bold">이용약관</h1>
      <p className="text-sm text-muted-foreground">시행일: 2026년 7월 10일</p>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">제1조 (목적)</h2>
        <p className="text-sm leading-relaxed">
          이 약관은 AI 로판 팩토리(이하 &ldquo;회사&rdquo;)가 제공하는 AI 기반 웹소설 기획 및 챕터 생성 서비스(이하
          &ldquo;서비스&rdquo;)의 이용과 관련하여 회사와 이용자의 권리, 의무 및 책임 사항, 기타 필요한 사항을
          규정함을 목적으로 합니다.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">제2조 (서비스의 개요)</h2>
        <p className="text-sm leading-relaxed">
          서비스는 이용자가 입력한 장르, 키워드 등 정보를 기반으로 인공지능(AI)이 웹소설의 아웃라인, 캐릭터
          시트, 에피소드 본문, 표지 프롬프트 등을 자동으로 생성하여 제공하는 웹소설 기획·집필 보조 도구입니다.
          회사는 서비스 제공을 위해 Google Gemini, xAI Grok, Anthropic Claude 등 외부 AI 제공사의 API를
          연동하여 사용합니다.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">제3조 (이용 계약의 체결 및 해지)</h2>
        <p className="text-sm leading-relaxed">
          ① 이용 계약은 이용자가 이 약관에 동의하고 회사가 정한 가입 양식에 따라 회원가입을 신청하고, 회사가
          이를 승낙함으로써 체결됩니다.
        </p>
        <p className="text-sm leading-relaxed">
          ② 이용자는 언제든지 서비스 내 설정 메뉴를 통해 회원 탈퇴를 요청할 수 있으며, 탈퇴 시 관련 법령에서
          별도로 정한 경우를 제외하고 이용자의 데이터는 즉시 삭제됩니다.
        </p>
        <p className="text-sm leading-relaxed">
          ③ 회사는 이용자가 이 약관 또는 관계 법령을 위반한 경우 사전 통지 후 이용 계약을 해지하거나 서비스
          이용을 제한할 수 있습니다.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">제4조 (요금제 및 무료 이용 한도)</h2>
        <p className="text-sm leading-relaxed">
          ① 회사는 무료(Free) 요금제와 유료(Pro) 요금제를 제공합니다.
        </p>
        <p className="text-sm leading-relaxed">
          ② 무료 요금제 이용자는 계정당 평생 최대 3회의 작품 생성 기회를 제공받습니다. 또한 동시에 최대 3개의
          프로젝트를 보유할 수 있으며, 프로젝트당 최대 3화의 에피소드를 생성할 수 있습니다.
        </p>
        <p className="text-sm leading-relaxed">
          ③ Pro 요금제는 월 9,900원(부가가치세 포함)의 이용료로 프로젝트 및 에피소드 생성 횟수 제한 없이
          서비스를 이용할 수 있으며, 무료 요금제보다 상위 성능의 AI 모델을 우선 적용합니다.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">제5조 (자동결제 및 해지)</h2>
        <p className="text-sm leading-relaxed">
          ① Pro 요금제는 이용자가 Toss Payments를 통해 등록한 결제 수단(빌링키)을 기반으로 매월 자동으로
          결제되며, 최초 결제일을 기준으로 매월 동일한 날짜에 정기 결제가 이루어집니다.
        </p>
        <p className="text-sm leading-relaxed">
          ② 이용자는 서비스 내 설정 메뉴에서 언제든지 정기결제를 해지할 수 있습니다. 해지를 신청하더라도
          이미 결제된 이용 기간의 종료일까지는 Pro 요금제 혜택이 계속 제공되며, 해당 이용 기간이 종료되면
          자동으로 무료(Free) 요금제로 전환됩니다.
        </p>
        <p className="text-sm leading-relaxed">
          ③ 정기결제 해지 시 이미 결제한 금액에 대한 일할 계산 환불은 제공되지 않습니다. 단, 「전자상거래
          등에서의 소비자보호에 관한 법률」 등 관계 법령에서 별도로 정한 청약철회 및 환불 사유에 해당하는
          경우에는 관련 법령에 따라 처리합니다.
        </p>
        <p className="text-sm leading-relaxed">
          ④ 결제 실패(카드 한도 초과, 유효기간 만료 등)가 반복되어 결제가 이루어지지 않는 경우 회사는 이용자의
          요금제를 무료(Free) 요금제로 전환할 수 있으며, 사전에 이메일 등으로 안내합니다.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">제6조 (생성 콘텐츠의 저작권)</h2>
        <p className="text-sm leading-relaxed">
          서비스를 통해 생성된 아웃라인, 캐릭터 시트, 에피소드 본문, 표지 프롬프트 등 모든 산출물에 대한
          저작권 및 그 밖의 일체의 권리는 해당 콘텐츠를 생성한 이용자에게 100% 귀속됩니다. 회사는 이용자의
          별도 동의 없이 생성 콘텐츠를 상업적으로 이용하거나 제3자에게 제공하지 않습니다.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">제7조 (AI 생성물의 특성 및 면책)</h2>
        <p className="text-sm leading-relaxed">
          ① 서비스가 제공하는 결과물은 인공지능 모델에 의해 자동으로 생성되며, 그 내용의 정확성, 완전성,
          독창성, 특정 목적에의 적합성을 보증하지 않습니다.
        </p>
        <p className="text-sm leading-relaxed">
          ② 생성된 콘텐츠는 기존에 발표된 저작물과 우연히 유사하거나 사실과 다른 내용을 포함할 수 있으며,
          이용자는 이를 활용(투고, 출판, 상업적 이용 등)하기 전에 반드시 직접 검토하고 필요한 경우 수정할
          책임이 있습니다.
        </p>
        <p className="text-sm leading-relaxed">
          ③ 회사는 AI 생성물의 이용으로 인해 이용자 또는 제3자에게 발생한 손해에 대하여 회사의 고의 또는
          중대한 과실이 없는 한 책임을 지지 않습니다.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">제8조 (이용자의 금지 행위)</h2>
        <p className="text-sm leading-relaxed">이용자는 서비스 이용과 관련하여 다음 각 호의 행위를 하여서는 안 됩니다.</p>
        <ul className="list-disc pl-5 text-sm leading-relaxed space-y-1">
          <li>타인의 계정을 도용하거나 부정한 방법으로 서비스에 접근하는 행위</li>
          <li>서비스를 이용하여 불법 콘텐츠, 음란물, 명예훼손·차별·혐오를 조장하는 콘텐츠를 생성·유포하는 행위</li>
          <li>서비스의 정상적인 운영을 방해하거나 비정상적인 방법으로 무료 이용 한도를 우회하는 행위</li>
          <li>서비스 또는 AI 모델을 역설계하거나 소스코드 추출을 시도하는 행위</li>
          <li>회사 또는 제3자의 지식재산권, 초상권, 개인정보 등 권리를 침해하는 행위</li>
          <li>기타 관계 법령 및 이 약관에 위배되는 행위</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">제9조 (서비스의 변경 및 중단)</h2>
        <p className="text-sm leading-relaxed">
          ① 회사는 운영상, 기술상의 필요에 따라 제공하는 서비스의 전부 또는 일부를 변경할 수 있으며, 변경
          사항은 서비스 내 공지 또는 이메일을 통해 사전에 안내합니다.
        </p>
        <p className="text-sm leading-relaxed">
          ② 회사는 천재지변, 시스템 장애, 연동된 AI 제공사(Google, xAI, Anthropic) 또는 결제사(Toss
          Payments)의 서비스 중단 등 불가항력적 사유가 발생한 경우 서비스의 전부 또는 일부를 일시적으로
          중단할 수 있습니다.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">제10조 (책임의 제한)</h2>
        <p className="text-sm leading-relaxed">
          회사는 천재지변, 불가항력, 이용자의 귀책사유 또는 제3자(AI 제공사, 결제사, 통신사 등)의 사정으로
          인한 서비스 장애에 대해서는 책임을 지지 않습니다. 또한 회사는 이용자가 서비스를 통해 얻은 정보나
          생성물을 신뢰함으로써 발생한 손해에 대해 관계 법령이 허용하는 범위 내에서 책임을 제한합니다.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">제11조 (준거법 및 관할)</h2>
        <p className="text-sm leading-relaxed">
          이 약관의 해석 및 회사와 이용자 간의 분쟁에 대해서는 대한민국 법령을 준거법으로 하며, 분쟁이 발생할
          경우 민사소송법상의 관할 법원에 소를 제기합니다.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">부칙</h2>
        <p className="text-sm leading-relaxed">이 약관은 2026년 7월 10일부터 시행합니다.</p>
      </section>
    </div>
  );
}

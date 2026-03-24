import type { Dictionary } from './types';

export const ko: Dictionary = {
  nav: {
    home: '홈',
    useCases: '활용 사례',
    playground: '플레이그라운드',
    docs: '문서',
    try: '체험',
  },
  hero: {
    headline: 'LLM 출력을\n시각 콘텐츠로 바꾸는 DSL.',
    sub: '렌더링 파이프라인도, 템플릿 엔진도 필요 없습니다. 구조화된 텍스트가 다이어그램, 슬라이드, 인포그래픽이 됩니다.',
    cta_playground: '플레이그라운드',
    cta_github: 'GitHub',
  },
  problem: {
    title: '왜 Depix인가?',
    before_title: '기존 파이프라인',
    before_desc: 'JSON 스키마, 템플릿 엔진, 헤드리스 브라우저, 스크린샷 캡처 — LLM이 예상 밖의 구조를 출력하면 깨지는 취약한 체인.',
    after_title: 'Depix 방식',
    after_desc: 'LLM이 텍스트를 출력합니다. compile()이 시각물로 바꿉니다. 3단계, 인프라 제로.',
  },
  howItWorks: {
    title: '코드 세 줄이면 충분합니다',
    sub: '시스템 프롬프트에 DSL 문법을 넣으세요. LLM이 Depix DSL을 출력합니다. 컴파일하고 렌더링하면 끝.',
    step1: '① LLM 시스템 프롬프트에 Depix DSL 문법을 추가',
    step2: '② LLM이 구조화된 DSL 텍스트를 출력 — JSON도 HTML도 아닌',
    step3: '③ compile()이 레이아웃, 테마, 좌표를 해석 → 렌더링',
  },
  examples: {
    title: 'LLM이 생성하는 것',
    sub: '하나의 프롬프트, 하나의 시각물. 아래 DSL은 자연어 요청으로부터 LLM이 생성한 것입니다.',
    prompt_label: '프롬프트',
    dsl_label: 'LLM 출력 (DSL)',
    result_label: '렌더링 결과',
    tabs: {
      flowchart: '플로우차트',
      slides: '슬라이드',
      dashboard: '대시보드',
      architecture: '아키텍처',
    },
    prompts: {
      flowchart: '"사용자 가입 플로우를 그려줘. 이메일 검증 실패 시 재시도 루프 포함."',
      slides: '"Q3 실적을 3장 슬라이드로 요약해줘."',
      dashboard: '"주요 지표가 포함된 시스템 모니터링 대시보드를 만들어줘."',
      architecture: '"마이크로서비스 아키텍처를 그려줘 — 클라이언트, API, 데이터 레이어."',
    },
  },
  integration: {
    title: '어디서든 통합 가능',
    sub: 'JavaScript가 실행되는 곳이면 어디든.',
    react_title: 'React 컴포넌트',
    react_desc: '단일 컴포넌트로 앱에 다이어그램을 삽입하세요. Provider 없이, Context 없이 — 자체 완결.',
    markdown_title: '마크다운 / 문서',
    markdown_desc: '마크다운에 depix 코드 블록을 사용하세요. 이미지 파일 관리 없이 인라인 시각물을 렌더링합니다.',
    api_title: '서버 사이드',
    api_desc: 'compile()은 Node.js와 Edge Runtime에서 실행됩니다. 어떤 백엔드에서든 PNG나 IR JSON을 생성하세요.',
  },
  footerCta: {
    title: '시작하기',
  },
  useCases: {
    title: '활용 사례',
    sub: 'Depix는 다양한 워크플로우에 적합합니다 — 마크다운 문서부터 LLM 기반 애플리케이션까지.',
    markdown_title: '마크다운 속에서',
    markdown_desc: '블로그, 위키, 문서에 코드 블록으로 다이어그램을 삽입하세요. 이미지 파일 관리가 필요 없습니다 — 소스가 텍스트니까.',
    slides_title: '슬라이드로',
    slides_desc: 'LLM에게 콘텐츠를 슬라이드로 요약해달라고 하세요. Depix 씬이 자동 레이아웃 프레젠테이션 페이지가 됩니다.',
    image_title: '이미지로',
    image_desc: 'Slack, 이메일, 문서에 PNG로 내보내세요. LLM 출력 → 함수 한 번 → 이미지 파일.',
    app_title: '앱 안에서',
    app_desc: 'React 앱 안에서 다이어그램을 렌더링하세요. LLM 응답에서 실시간으로 생성되는 시각물을 사용자에게 보여주세요.',
  },
  playground: {
    title: '플레이그라운드',
    placeholder: '// Depix DSL을 작성하세요...\n\nflow direction:right {\n  node "안녕" #a\n  node "세상" #b\n  #a -> #b\n}',
    error_label: '오류',
  },
  placeholder: {
    coming_soon: '준비 중입니다.',
    back_home: '← 홈으로',
  },
  footer: {
    tagline: '구조화된 텍스트로 만드는 선언적 시각물.',
  },
};

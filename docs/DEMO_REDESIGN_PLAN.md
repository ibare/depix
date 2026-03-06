# Demo App Redesign Plan

## 요구사항

1. ASCII 표현으로 설명된 다양한 개념을 depix DSL로 표현, 렌더링되는 흐름을 명확히 보여주는 메인 페이지
2. DSL을 단일 요소 → 복합 요소 → 복잡한 표현 순으로 단계적 상승하며 확인할 수 있는 페이지
3. DSL 문법을 꼼꼼히 설명하는 레퍼런스 페이지
4. 모든 렌더링 요소에서 에디터 도구를 즉시 호출할 수 있어야 함 (v1 UX 유지)

---

## 페이지 구성

### 1. Showcase (메인) — 요구사항 1

ASCII/개념 → DSL → 렌더링 캔버스의 3단 패널로 변환 과정을 시각적으로 증명.

예제 라인업:
- 데이터 파이프라인 (flow)
- 기능 비교표 (grid)
- 조직도 (tree)
- 아키텍처 스택 (layers)
- 단계별 프로세스 (stack)
- 복합 시스템 설계 (flow + group)

### 2. Playground — 요구사항 2

3단계 레벨 구조:

**Level 1: 기초 요소** — box, node, label, badge, list, divider 등 단일 요소
**Level 2: 레이아웃** — flow, stack, grid, tree, layers, group 복합 구조
**Level 3: 고급 조합** — 중첩 레이아웃, 멀티씬, 스타일링, 시맨틱 토큰

좌측 예제 목록 + 우측 DSL 편집기 + 캔버스 프리뷰 레이아웃.

### 3. Reference — 요구사항 3

DSL 문법 완전 가이드. 각 섹션에 라이브 예제 포함.

목차:
1. 문서 구조 (@page, scene)
2. 레이아웃 프리미티브 (flow, stack, grid, tree, group, layers)
3. 시각 요소 (box, node, label, badge, icon, list, divider, image)
4. 연결과 ID (#id, ->, -->, --, <->)
5. 스타일링 (인라인 스타일, 시맨틱 컬러, 시맨틱 토큰, 플래그)
6. 저수준 폴백 (canvas)

### 4. 에디터 즉시 호출 — 요구사항 4

모든 캔버스에 DepixCanvasEditable 사용. hover → "Edit" → 편집 모드 즉시 진입.

---

## 파일 구조

```
apps/demo/src/
├── App.tsx                      # 페이지 라우팅 (상태 기반)
├── App.css                      # 글로벌 스타일
├── main.tsx
├── components/
│   ├── Header.tsx               # 네비게이션
│   ├── LiveExample.tsx          # DSL + DepixCanvasEditable 래퍼
│   ├── AsciiPanel.tsx           # ASCII 표현 패널 (Showcase용)
│   ├── CodePanel.tsx            # DSL 코드 표시/편집
│   ├── ThemeSwitcher.tsx        # 테마 전환
│   └── ExportButton.tsx         # PNG 내보내기
├── pages/
│   ├── ShowcasePage.tsx         # 메인
│   ├── PlaygroundPage.tsx       # 단계적 학습
│   └── ReferencePage.tsx        # 문법 가이드
├── data/
│   ├── showcase-examples.ts     # ASCII + DSL 페어
│   ├── playground-levels.ts     # 레벨별 예제
│   └── reference-sections.ts    # 문법 섹션별 설명 + 예제
└── tabs/                        # 삭제 대상
```

## 삭제 대상

- tabs/GalleryTab.tsx → ShowcasePage로 대체
- tabs/EditorTab.tsx → PlaygroundPage + LiveExample로 대체
- examples/index.ts → data/ 하위 파일들로 재구성

---

## 기술적 결정

| 항목 | 결정 | 근거 |
|------|------|------|
| 라우팅 | 상태 기반 탭 전환 | 데모앱이므로 react-router 의존성 불필요 |
| 모든 캔버스 | DepixCanvasEditable | 요구사항 4, v1 UX 그대로 활용 |
| DSL 편집기 | textarea | 기존 방식 유지, 향후 CodeMirror 도입 가능 |
| 테마 연동 | UI 테마 ↔ DSL 테마 통합 | 현재 이원화 문제 해결 |

---

## 구현 순서

| 단계 | 작업 | 산출물 |
|------|------|--------|
| S1 | LiveExample 공통 컴포넌트 + CodePanel | 앱 전체의 기반 컴포넌트 |
| S2 | data/ 예제 데이터 전체 작성 | showcase, playground, reference 데이터 |
| S3 | ShowcasePage (메인) | ASCII→DSL→Canvas 3단 시연 |
| S4 | PlaygroundPage | 3레벨 단계적 학습 |
| S5 | ReferencePage | 문법 완전 가이드 |
| S6 | App.tsx + Header.tsx 개편 + CSS | 네비게이션, 스타일 통합 |
| S7 | 기존 tabs/, examples/ 정리 | 삭제, 최종 정리 |

---

## 진행 상태

- [x] S1: LiveExample + CodePanel
- [x] S2: 예제 데이터
- [x] S3: ShowcasePage
- [x] S4: PlaygroundPage
- [x] S5: ReferencePage
- [x] S6: App + Header + CSS
- [x] S7: 정리

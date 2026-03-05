# 프로젝트 구조 분석

## 기본 정보

- **언어**: TypeScript (strict mode, ESM)
- **주요 프레임워크/라이브러리**: React 19, Konva 9, Vitest, TipTap
- **모노레포**: pnpm workspace
- **모듈/패키지 목록**:
  - `@depix/core` — IR 타입, 컴파일러, 테마, 레이아웃 알고리즘 (순수 TS, DOM 의존 없음)
  - `@depix/engine` — Konva 렌더러, 좌표 변환, PNG 내보내기
  - `@depix/editor` — 선택, 히스토리, 핸들, 스냅, IR 직접 조작
  - `@depix/react` — React 컴포넌트, 훅, TipTap 직렬화
  - `apps/demo` — Vite + React 데모 앱
- **빌드 시스템**: tsc (composite project references)
- **테스트 프레임워크**: Vitest (core=node, engine/editor/react=happy-dom)
- **정적 분석 도구**: ESLint (typescript-eslint), TypeScript strict mode

## 규모

- 총 테스트: 1,555개 (core 839 / engine 102 / editor 315 / react 299)
- 핵심 소스 파일: ~80개 (packages/*/src/)

## 핵심 도메인

- **Compiler**: DSL 텍스트 → AST → DepixIR. tokenizer → parser → passes (resolveTheme, planLayout, scaleSystem, allocateBounds, layout, routeEdges, emitIR) 순서로 진행되는 8단계 파이프라인
- **DepixIR**: 모든 좌표/색상/경로가 완전히 해결된 JSON 문서. 전체 시스템의 데이터 계약
- **Renderer**: IR을 받아 Konva 노드를 생성하기만 하는 단순 매핑 레이어
- **Editor**: IR을 직접 조작하는 불변 연산 모음 (structuredClone 패턴)
- **React**: DepixEngine + Editor managers를 통합하는 React 컴포넌트 레이어

## 패키지 의존 방향

```
@depix/core  ←  @depix/engine  ←  @depix/editor  ←  @depix/react
```

역방향 의존은 아키텍처 위반이다.

## 발견된 공통 패턴

- IR 조작 함수는 `structuredClone`으로 깊은 복사 후 변경된 새 IR을 반환
- 컴파일러 각 패스는 순수 함수 (입력 → 출력, 부수효과 없음)
- 레이아웃 결과는 정확한 좌표가 아닌 불변식(invariant)으로 테스트
- 모든 내부 import에 `.js` 확장자 사용 (TypeScript ESM 규칙)
- 각 패키지는 `src/index.ts` barrel export를 통해서만 외부 노출
- 컴파일 에러는 throw하지 않고 `ParseError[]` 배열로 수집하여 반환

## 발견된 안티패턴 (주의 필요)

- Konva 의존이 engine 외부로 누수될 경우 렌더러 교체가 불가능해짐
- IR에 시맨틱 토큰(primary, md 등)이 남아 있으면 렌더러가 해석 불가
- 컴파일러 패스 내부에서 전역 상태나 캐시를 사용하면 테스트 재현성이 깨짐

## 정적 분석 커버 영역 (Rules에서 제외)

- unused vars (ESLint: `_` prefix 패턴)
- explicit any (ESLint warning)
- 타입 오류, null 체크 (TypeScript strict)
- import 중복, 미사용 import (TypeScript)

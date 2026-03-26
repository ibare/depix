# Depix 프로젝트 분석

## 기본 정보
- 언어: TypeScript (strict mode)
- 주요 프레임워크: React 19, Konva, Vitest
- 모노레포: pnpm workspace
- 패키지: @depix/core, @depix/engine, @depix/editor, @depix/react
- 앱: apps/demo, apps/website
- 빌드: tsc (라이브러리), Vite (앱)
- 테스트: Vitest (core=node, engine/editor/react=happy-dom)
- 정적 분석: ESLint (minimal), Prettier, TypeScript strict

## 규모
- 소스 파일: ~406개 (.ts, .tsx)
- 테스트 파일: ~74개
- 소스 라인: ~22,000 (packages)
- 테스트: 2,143+

## 핵심 도메인
1. **Compiler Pipeline** (core): DSL → AST → IR. 8단계 순수 함수 파이프라인.
2. **Layout Engine** (core): flow/tree/stack/grid/layers 등 7종 레이아웃 알고리즘.
3. **Renderer** (engine): Konva 기반 IR → Canvas 렌더링. 좌표 변환, PNG 내보내기.
4. **Editor** (editor): 선택, 히스토리, 핸들, 스냅, IR 조작, DSL 뮤테이션.
5. **React Integration** (react): DepixCanvas/Editable, DSL 에디터, Zustand store, 훅.

## 정적 분석 현황
- ESLint: no-unused-vars (warn, ^_ 패턴), no-explicit-any (warn). 최소 설정.
- Prettier: single quotes, 2-space indent, 100 char width, trailing commas.
- TypeScript: strict mode, bundler resolution, composite builds.
- **ESLint로 커버되지 않는 것**: 레이어 의존성 방향, IR 불변성, Konva 격리 → Rules로 커버.

## 발견된 공통 패턴
- 모든 컴파일러 패스가 순수 함수 (입력→출력, 부수효과 없음)
- IR 조작 시 structuredClone 사용 (불변성 보장)
- Konva 접근은 @depix/engine 내부로 격리
- 패키지 간 의존은 barrel export (index.ts)만 사용
- DSL 뮤테이션은 parse → AST 조작 → serialize 패턴

## 발견된 안티패턴
- DepixCanvasEditable.tsx가 980줄로 과대 (C1 300줄 기준 초과)
- InspectorPanel.tsx가 556줄
- ESLint가 minimal해서 import 순서, 미사용 export 등 미검출
- 앱 레벨 코드(demo, website)에 대한 규칙 부재

## 규칙 커버리지 갭 (우선순위)
1. HIGH: DSL 뮤테이션 안전성 (S-dsl-mutations)
2. MEDIUM: React 훅 설계 패턴 (추후 필요시)
3. LOW: 앱 레벨 패턴, 빌드/배포 패턴

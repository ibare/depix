---
version: 1
last_verified: 2026-03-26
---

# Static Analysis Tooling — C5

## When to Apply

정적 분석 도구 설정을 변경하거나, 새로운 lint 규칙을 추가/제거할 때.

## MUST

- TypeScript strict 모드를 유지한다. `tsconfig.json`에서 `strict: true`를 해제하지 않는다.
- 패키지의 public API는 `src/index.ts`에서만 export한다 (C1과 동일, 정적 분석으로 미검증).
- ESLint와 Prettier 설정을 변경할 때는 전체 코드베이스에 `pnpm lint`를 실행하여 영향을 확인한다.

## MUST NOT

- ESLint의 `no-unused-vars`를 `off`로 변경하지 않는다.
- `@ts-ignore`를 사용하지 않는다. 불가피한 경우 `@ts-expect-error`에 사유를 주석으로 남긴다.
- `any` 타입을 새로 도입하지 않는다. 기존 `any`는 점진적으로 제거한다.

## PREFER

- 새로운 ESLint 규칙 추가 시 `error`보다 `warn`으로 먼저 도입하여 기존 코드와의 충돌을 확인한다.

## 현재 도구 현황

| 도구 | 설정 파일 | 주요 규칙 |
|------|----------|----------|
| TypeScript | tsconfig.json | strict: true, bundler resolution |
| ESLint | eslint.config.js | no-unused-vars (warn), no-explicit-any (warn) |
| Prettier | .prettierrc | single quotes, 2-space, 100 char, trailing commas |

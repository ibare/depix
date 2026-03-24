# emit-scene.ts 분리 계획

## 배경

`emit-scene.ts`는 현재 1200줄 이상으로, C1 규칙(300줄 초과 파일 수정 시 분리 계획 수립)에 따라
이 문서를 선행 작성한다.

## 현재 구조 (단일 파일)

```
emit-scene.ts
  ├─ Public API: emitSceneIR, emitScene, emitSceneContent
  ├─ Height estimation: CONTENT_HEIGHT_ESTIMATORS, estimateContentHeight,
  │                     computeCompactHeights, adaptBaseFontSize
  ├─ Overflow utilities: estimateTextWidth, computeFitScale, adaptBoxPadding (신규)
  ├─ Element emitters: emitHeading, emitLabel, emitBullet, emitStat, emitQuote,
  │                    emitSceneDivider, emitSceneShape, emitColumn, emitBoxBlock,
  │                    emitSceneTable, emitImage, emitIcon, emitStep
  ├─ Chart emitters: emitSceneChart, emitSceneBarChart, emitSceneLineChart,
  │                  emitScenePieChart, emitSceneChartAxes
  └─ Meta/Background: buildSceneMeta, emitSceneBackground, buildSceneTransitions,
                      resolveElementStyle
```

## 목표 분리 구조

```
scene/
  emit-scene.ts          — Public API + 오케스트레이션만 (~150줄)
  scene-fit-utils.ts     — 추정/적응 유틸리티 (~100줄)
  scene-element-emit.ts  — 리프 엘리먼트 emitter (~400줄)
  scene-container-emit.ts — 컨테이너 emitter (column, box, table) (~200줄)
  scene-chart-emit.ts    — 차트 emitter (~350줄)
  scene-meta.ts          — Meta, Background, Transitions (~100줄)
```

## 분리 우선순위

1. `scene-chart-emit.ts` — 차트 로직은 독립적, 분리 용이
2. `scene-fit-utils.ts` — overflow 유틸리티, 다른 파일에서 import
3. `scene-element-emit.ts` + `scene-container-emit.ts` — 메인 분리
4. `scene-meta.ts` — 마무리

## 주의사항

- 분리 시 `emitSceneContent` (중앙 dispatch 함수)가 모든 emitter를 참조하므로
  circular import 주의 필요.
- `emitBoxBlock`이 `emitSceneContent`를 콜백으로 받으므로 컨테이너 분리 시
  해당 콜백 패턴 유지 필요.

## 상태

- [ ] 분리 실행 (현재 overflow 적응 구현 완료 후 진행)

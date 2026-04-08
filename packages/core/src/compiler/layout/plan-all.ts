/**
 * `planAll` — AST를 단일 `PlanNode` 트리로 변환하는 진입점.
 *
 * 이 함수는 옛 파이프라인의 세 함수를 **하나로 합친** 결과다:
 *   - `compiler.ts::normalizeScenes` — Scene 정규화
 *   - `scene/plan-scene.ts::planScene` — Scene → SceneNode (삭제)
 *   - `layout/plan-layout.ts::planLayout` — Block → DiagramLayoutPlan (삭제)
 *
 * 입력은 `ASTDocument`(전체 문서)이며, 출력은 단일 `PlanNode`다.
 * 문서에 여러 scene이 있으면 각 scene이 트리의 루트 PlanNode가 되는 것이 아니라,
 * **문서 레벨의 scene 배열 전체를 갖는 단일 PlanNode 트리**를 반환한다. 단,
 * 현재 `compile()`은 scene별로 loop하므로 이 함수는 scene 하나당 한 번 호출된다.
 * (본 파일의 `planAll`은 단일 scene 블록을 받는 시그니처를 제공한다.)
 *

 * PR-1 Step C에서 `compiler.ts::compile()`이 이 함수를 호출하도록 교체된다.
 */

import type { ASTBlock, ASTDocument } from '../ast.js';
import type { DepixTheme } from '../../theme/types.js';
import { planSceneBlock } from './plan-all-scene.js';
import type { PlanNode } from './plan-types.js';

// ---------------------------------------------------------------------------
// planAll — scene 하나당 한 번 호출
// ---------------------------------------------------------------------------

/**
 * 단일 AST scene 블록을 PlanNode 트리로 변환.
 *
 * 규칙:
 *   - 항상 `blockType === 'scene'`인 루트 PlanNode를 반환한다.
 *   - 비-scene 블록(`flow`, `stack`, ...)은 implicit scene(`layout: full`, `body` slot)으로 감싸진다.
 *   - 생성되는 모든 노드의 id는 안정적인 prefix/index 기반 (테스트 및 Map 키 일관성).
 *
 * `theme` 파라미터는 향후 확장용. 현재는 사용하지 않지만, 옛 `planNode`가
 * theme를 받았던 관용을 유지한다 (structural-roles가 theme에 의존하기 시작하면 여기 전달).
 *
 * 이 함수는 순수 함수다. 모듈 상태나 전역을 읽거나 쓰지 않는다 (S-compiler MUST NOT).
 */
export function planAll(block: ASTBlock, _theme: DepixTheme, rootId = 'scene'): PlanNode {
  return planSceneBlock(block, rootId, makeChildId);
}

/**
 * 문서 레벨 진입점 — 모든 scene에 대해 `planAll`을 호출.
 *
 * 반환: scene 순서대로 `PlanNode[]`. 각 원소는 `blockType === 'scene'`이다.
 *
 * 이 함수는 `compile()`의 scene loop를 대체하는 경로이며, emit walker와 쌍으로 사용된다.
 */
export function planDocument(ast: ASTDocument, theme: DepixTheme): PlanNode[] {
  return ast.scenes.map((block, index) => planAll(block, theme, `scene-${index}`));
}

// ---------------------------------------------------------------------------
// ID factory
// ---------------------------------------------------------------------------

/**
 * 부모 id와 자식 순서를 받아 자식 id를 만든다. 단순 `${parent}-${index}` 패턴.
 *
 * 옛 `plan-layout.ts::planNode`의 id 생성 관용(`${parent}-child-${i}`)과 호환되도록
 * 같은 접미사 형식을 사용한다. Step D 테스트 작성 시 id 패턴이 중요하다.
 */
function makeChildId(parent: string, index: number): string {
  return `${parent}-child-${index}`;
}

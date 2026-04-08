/**
 * `planAll` — 단일 AST scene 블록을 `PlanNode` 트리로 변환하는 진입점.
 *
 * depix 구조: **scene = 독립 파이프라인 루트**, document = scene들의 컬렉션.
 * `compile()`은 각 scene PlanNode 루트에서 파이프라인을 1회씩 돌린다.
 * 이 모듈은 두 진입점을 제공한다:
 *   - `planAll(block, theme, rootId?)`  — 단일 scene 블록 → 단일 scene PlanNode
 *   - `planDocument(ast, theme)`        — ASTDocument → PlanNode[] (scene별 planAll)
 *
 * "document-level 단일 루트"가 아닌 것은 설계 결정이다 (S-pipeline.md MUST NOT 참조):
 * depix의 여러 scene 사이에는 공간/배치 관계가 없으며, `@page *` auto-height는
 * single-scene 전제 기능이다. scene들을 wrapper PlanNode로 묶는 facade는
 * 의미 없는 구조적 기만이다.
 *
 * 이 함수는 옛 파이프라인의 세 함수를 **하나로 합친** 결과다:
 *   - `compiler.ts::normalizeScenes` — Scene 정규화
 *   - `scene/plan-scene.ts::planScene` — Scene → SceneNode (삭제)
 *   - `layout/plan-layout.ts::planLayout` — Block → DiagramLayoutPlan (삭제)
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

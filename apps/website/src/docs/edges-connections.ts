// synced_with: 'edges-connections@b235661c'

export const edgesConnections = {
  id: 'edges-connections',
  title: 'Edges',
  titleKo: '엣지 (연결선)',
  content: `
## Overview

Edges are the lines and arrows that connect elements by their \`#id\`. They express relationships, data flow, dependencies, and sequences between nodes in your diagrams.

Edges are only valid inside diagram blocks — specifically \`flow\` and \`tree\` blocks. To use edges, the connected elements must have IDs assigned.

---

## Arrow Syntax

Depix provides four arrow types, each with distinct visual meaning:

| Syntax | Name | Visual | Typical Use |
|--------|------|--------|-------------|
| \`#a -> #b\` | Directed arrow | Solid line with triangle arrowhead | Main flow, primary connections |
| \`#a --> #b\` | Dashed arrow | Dashed line with triangle arrowhead | Secondary paths, optional flows, async |
| \`#a -- #b\` | Undirected line | Solid line, no arrowhead | Associations, bidirectional relationships |
| \`#a <-> #b\` | Bidirectional arrow | Solid line with arrowheads on both ends | Two-way communication, mutual dependencies |

\`\`\`depix
flow {
  node "Client" #client
  node "Server" #server
  node "Database" #db
  node "Cache" #cache

  #client -> #server          // primary request flow
  #server -> #db              // data access
  #server --> #cache          // optional cache lookup
  #client <-> #server         // bidirectional communication
  #cache -- #db               // association
}
\`\`\`

---

## Edge Labels

Add descriptive text to any edge by placing a quoted string after the target node. Labels appear along the edge line, helping to explain what the connection represents.

\`\`\`depix
flow {
  diamond "Valid?" #check
  rect "Process" #process
  rect "Reject" #reject

  #check -> #process "Yes"
  #check --> #reject "No"
}
\`\`\`

Labels are particularly valuable on decision branches (coming from \`diamond\` nodes) to clearly indicate which path each branch represents.

---

## Edge Chains

Connect multiple nodes in a single line using chain syntax. This is a convenient shorthand that creates multiple edges at once.

\`\`\`depix
#a -> #b -> #c -> #d
\`\`\`

This single line creates three separate edges: \`#a -> #b\`, \`#b -> #c\`, and \`#c -> #d\`.

Chains are a great way to express linear processes concisely:

\`\`\`depix
flow {
  pill "Start" #s
  rect "Step 1" #a
  rect "Step 2" #b
  rect "Step 3" #c
  pill "End" #e

  #s -> #a -> #b -> #c -> #e
}
\`\`\`

> **Note:** Edge chains use the same arrow type throughout the chain. If you need mixed arrow types (e.g., solid then dashed), write them as separate edge declarations.

---

## Cycle / Back-Edge Support

Depix automatically detects back-edges (edges that point backward in the graph, creating cycles or loops). These are rendered with wider, curved paths to visually distinguish them from forward edges.

\`\`\`depix
flow {
  node "Start"  #start
  diamond "OK?" #check
  node "Fix"    #fix
  pill "Done"   #end

  #start -> #check
  #check -> #fix "No"
  #fix -> #check            // back-edge: automatically curved
  #check -> #end "Yes"
}
\`\`\`

In this example, \`#fix -> #check\` creates a loop back to the decision point. The renderer detects this cycle and routes the edge with a curved path that avoids overlapping with other edges, making the loop clearly visible.

This is particularly useful for:
- **Retry loops** — processes that repeat until a condition is met
- **Feedback cycles** — iterative workflows with review steps
- **State machines** — states that can transition back to previous states

---

## Important Notes

- **Edges require IDs.** Both the source and target elements must have \`#id\` assigned. Without IDs, the compiler cannot resolve the connection.

- **Only inside diagram blocks.** Edges are only valid inside \`flow\` and \`tree\` blocks. Writing edges at the top level or inside other block types (like \`stack\` or \`grid\`) will result in a compiler error.

- **IDs must be unique** within their containing block. Using duplicate IDs will lead to ambiguous connections.

- **Order doesn't matter.** You can declare edges before or after the elements they connect — the compiler resolves references by ID, not by declaration order.

> **Tip:** Define all elements first, then all edges. This makes your code easier to read: the "what" (elements) is separate from the "how they connect" (edges).
  `,
  contentKo: `
## 개요

엣지는 \`#id\`를 통해 요소를 연결하는 선과 화살표입니다. 다이어그램의 노드 간 관계, 데이터 흐름, 의존성, 순서를 표현합니다.

엣지는 다이어그램 블록 내부에서만 유효합니다 — 구체적으로 \`flow\`와 \`tree\` 블록입니다. 엣지를 사용하려면 연결할 요소에 ID가 지정되어 있어야 합니다.

---

## 화살표 문법

Depix는 각각 고유한 시각적 의미를 가진 네 가지 화살표 유형을 제공합니다:

| 문법 | 이름 | 시각 표현 | 일반적 용도 |
|------|------|----------|------------|
| \`#a -> #b\` | 유향 화살표 | 실선 + 삼각형 화살촉 | 주요 흐름, 기본 연결 |
| \`#a --> #b\` | 점선 화살표 | 점선 + 삼각형 화살촉 | 부차 경로, 선택적 흐름, 비동기 |
| \`#a -- #b\` | 무향 선 | 실선, 화살촉 없음 | 연관, 양방향 관계 |
| \`#a <-> #b\` | 양방향 화살표 | 실선 + 양끝 화살촉 | 양방향 통신, 상호 의존 |

\`\`\`depix
flow {
  node "클라이언트" #client
  node "서버" #server
  node "데이터베이스" #db
  node "캐시" #cache

  #client -> #server          // 주요 요청 흐름
  #server -> #db              // 데이터 접근
  #server --> #cache          // 선택적 캐시 조회
  #client <-> #server         // 양방향 통신
  #cache -- #db               // 연관
}
\`\`\`

---

## 엣지 라벨

대상 노드 뒤에 따옴표 문자열을 배치하여 엣지에 설명 텍스트를 추가합니다. 라벨은 엣지 선을 따라 표시되어 연결의 의미를 설명합니다.

\`\`\`depix
flow {
  diamond "유효?" #check
  rect "처리" #process
  rect "거부" #reject

  #check -> #process "예"
  #check --> #reject "아니오"
}
\`\`\`

라벨은 특히 \`diamond\` 노드에서 나오는 결정 분기에서 각 경로가 무엇을 나타내는지 명확히 표시할 때 유용합니다.

---

## 엣지 체인

체인 문법을 사용하여 한 줄에 여러 노드를 연결할 수 있습니다. 여러 엣지를 한 번에 생성하는 편리한 축약형입니다.

\`\`\`depix
#a -> #b -> #c -> #d
\`\`\`

이 한 줄은 세 개의 개별 엣지를 생성합니다: \`#a -> #b\`, \`#b -> #c\`, \`#c -> #d\`.

체인은 선형 프로세스를 간결하게 표현하는 좋은 방법입니다:

\`\`\`depix
flow {
  pill "시작" #s
  rect "단계 1" #a
  rect "단계 2" #b
  rect "단계 3" #c
  pill "종료" #e

  #s -> #a -> #b -> #c -> #e
}
\`\`\`

> **참고:** 엣지 체인은 체인 전체에 동일한 화살표 유형을 사용합니다. 혼합 화살표 유형(예: 실선 후 점선)이 필요하면 별도의 엣지 선언으로 작성하세요.

---

## 순환 / 역방향 엣지 지원

Depix는 역방향 엣지(그래프에서 뒤로 향하는 엣지, 순환이나 루프를 생성)를 자동으로 감지합니다. 이러한 엣지는 전방 엣지와 시각적으로 구분하기 위해 넓은 곡선 경로로 렌더링됩니다.

\`\`\`depix
flow {
  node "시작"     #start
  diamond "OK?"  #check
  node "수정"     #fix
  pill "완료"     #end

  #start -> #check
  #check -> #fix "아니오"
  #fix -> #check            // 역방향 엣지: 자동으로 곡선 처리
  #check -> #end "예"
}
\`\`\`

이 예시에서 \`#fix -> #check\`는 결정 포인트로 돌아가는 루프를 생성합니다. 렌더러가 이 순환을 감지하고 다른 엣지와 겹치지 않는 곡선 경로로 엣지를 라우팅하여 루프를 명확하게 보여줍니다.

이 기능은 다음에 특히 유용합니다:
- **재시도 루프** — 조건이 충족될 때까지 반복하는 프로세스
- **피드백 사이클** — 검토 단계가 있는 반복 워크플로우
- **상태 머신** — 이전 상태로 되돌아갈 수 있는 상태 전이

---

## 중요 사항

- **엣지에는 ID가 필수입니다.** 출발 요소와 도착 요소 모두 \`#id\`가 지정되어 있어야 합니다. ID가 없으면 컴파일러가 연결을 해석할 수 없습니다.

- **다이어그램 블록 내부에서만 유효합니다.** 엣지는 \`flow\`와 \`tree\` 블록 안에서만 사용할 수 있습니다. 최상위나 다른 블록 유형(\`stack\`, \`grid\` 등) 안에서 엣지를 작성하면 컴파일 오류가 발생합니다.

- **ID는 고유해야 합니다.** 포함 블록 내에서 중복 ID를 사용하면 모호한 연결이 발생합니다.

- **순서는 중요하지 않습니다.** 엣지를 연결하려는 요소의 앞이나 뒤에 선언할 수 있습니다 — 컴파일러는 선언 순서가 아닌 ID로 참조를 해석합니다.

> **팁:** 모든 요소를 먼저 정의한 다음, 모든 엣지를 정의하세요. "무엇"(요소)과 "어떻게 연결되는지"(엣지)를 분리하면 코드 가독성이 크게 향상됩니다.
  `,
};

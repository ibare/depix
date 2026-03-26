// synced_with: 'comments@03b5a5ba'

export const comments = {
  id: 'comments',
  title: 'Comments',
  titleKo: '주석',
  content: `
## Line Comments

Depix supports single-line comments using \`//\`. Everything after \`//\` on a line is ignored by the compiler.

Comments can appear on their own line or at the end of a line of code (inline comments):

\`\`\`depix
// This is a standalone comment describing the next section
node "Server" #server  // This node represents the main server

// You can use comments to temporarily disable lines:
// node "Unused" #unused

flow {
  node "A" #a
  node "B" #b
  #a -> #b  // Connect A to B
}
\`\`\`

> **Note:** Depix only supports line comments (\`//\`). There are no block comments (\`/* */\`).

Comments are useful for documenting your DSL code, leaving notes for collaborators, or temporarily disabling elements during development.
  `,
  contentKo: `
## 라인 주석

Depix는 \`//\`를 사용한 한 줄 주석을 지원합니다. 한 줄에서 \`//\` 이후의 모든 내용은 컴파일러가 무시합니다.

주석은 독립적인 줄에 작성하거나, 코드 뒤에 인라인으로 추가할 수 있습니다:

\`\`\`depix
// 다음 섹션을 설명하는 독립 주석
node "Server" #server  // 메인 서버를 나타내는 노드

// 주석으로 특정 줄을 임시로 비활성화할 수도 있습니다:
// node "Unused" #unused

flow {
  node "A" #a
  node "B" #b
  #a -> #b  // A에서 B로 연결
}
\`\`\`

> **참고:** Depix는 라인 주석(\`//\`)만 지원합니다. 블록 주석(\`/* */\`)은 없습니다.

주석은 DSL 코드를 문서화하거나, 협업자에게 메모를 남기거나, 개발 중 요소를 임시로 비활성화할 때 유용합니다.
  `,
};

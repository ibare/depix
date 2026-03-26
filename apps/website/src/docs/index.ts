export { documentStructure } from './document-structure';
export { comments } from './comments';
export { elements } from './elements';
export { blocks } from './blocks';
export { edgesConnections } from './edges-connections';
export { scenes } from './scenes';
export { directives } from './directives';
export { completeExamples } from './complete-examples';
export { quickReference } from './quick-reference';

export interface DocSection {
  id: string;
  title: string;
  titleKo: string;
  content: string;
  contentKo: string;
}

export const ALL_SECTIONS: DocSection[] = [
  // Lazy import to keep this file as the single ordering source
];

// Populated after imports resolve — use getSections() instead
import { documentStructure } from './document-structure';
import { comments } from './comments';
import { elements } from './elements';
import { blocks } from './blocks';
import { edgesConnections } from './edges-connections';
import { scenes } from './scenes';
import { directives } from './directives';
import { completeExamples } from './complete-examples';
import { quickReference } from './quick-reference';

export function getSections(): DocSection[] {
  return [
    documentStructure,
    comments,
    elements,
    blocks,
    edgesConnections,
    scenes,
    directives,
    completeExamples,
    quickReference,
  ];
}

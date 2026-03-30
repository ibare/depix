/**
 * Example: Render a DSL diagram with <DepixCanvasEditable>
 *
 * Usage:
 *   import { DepixCanvasEditable } from '@depix/react';
 *   import { compile } from '@depix/core';
 *
 *   const { ir } = compile(dsl);
 *   <DepixCanvasEditable ir={ir} onIRChange={() => {}} width={800} height={450} />
 */
import { useState } from 'react';
import { DepixCanvasEditable } from '@depix/react';
import type { DepixCanvasEditableRef } from '@depix/react';
import { compile } from '@depix/core';
import type { DepixIR } from '@depix/core';
import { useRef } from 'react';

const dsl = `
@page 16:9

flow direction:right {
  node "Input" #a
  node "Process" #b
  node "Output" #c { shape: diamond }

  #a -> #b
  #b -> #c "result"
}
`;

export function BasicExample() {
  const [ir, setIr] = useState<DepixIR>(() => compile(dsl).ir);
  const ref = useRef<DepixCanvasEditableRef>(null);

  return (
    <div>
      <DepixCanvasEditable ref={ref} ir={ir} onIRChange={setIr} width={800} height={450} />
    </div>
  );
}

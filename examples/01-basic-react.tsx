/**
 * Example: Render a DSL diagram with <DepixCanvas>
 *
 * Usage:
 *   import { DepixCanvas } from '@depix/react';
 *   <DepixCanvas data={dsl} width={800} height={450} />
 */
import { useRef } from 'react';
import { DepixCanvas } from '@depix/react';
import type { DepixCanvasRef } from '@depix/react';

const dsl = `
@page 16:9
@theme light

flow direction:right {
  node "Input" #a
  node "Process" #b
  node "Output" #c { shape: diamond }

  #a -> #b
  #b -> #c "result"
}
`;

export function BasicExample() {
  const ref = useRef<DepixCanvasRef>(null);

  return (
    <div>
      <DepixCanvas ref={ref} data={dsl} width={800} height={450} />
      <button onClick={() => ref.current?.nextScene()}>Next Scene</button>
    </div>
  );
}

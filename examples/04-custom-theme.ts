/**
 * Example: Create and apply a custom theme
 *
 * Extend the built-in lightTheme with custom colors,
 * then compile DSL using your theme.
 */
import { compile, lightTheme } from '@depix/core';
import type { DepixTheme } from '@depix/core';

// Create a custom theme based on lightTheme
const oceanTheme: DepixTheme = {
  ...lightTheme,
  name: 'ocean',
  colors: {
    ...lightTheme.colors,
    primary: '#0077b6',
    secondary: '#00b4d8',
    accent: '#90e0ef',
    success: '#06d6a0',
    warning: '#ffd166',
    danger: '#ef476f',
    info: '#118ab2',
    muted: '#a8dadc',
  },
  background: '#caf0f8',
  foreground: '#023e8a',
};

// Compile DSL with the custom theme
const dsl = `
@page 16:9

flow direction:right {
  node "Collect" #a { color: primary }
  node "Analyze" #b { color: secondary }
  node "Report" #c { color: success }

  #a -> #b
  #b -> #c
}
`;

const { ir, errors } = compile(dsl, { theme: oceanTheme });

console.log('Theme:', oceanTheme.name);
console.log('Errors:', errors.length);
console.log('Scenes:', ir.scenes.length);
console.log('Elements:', ir.scenes[0].elements.length);

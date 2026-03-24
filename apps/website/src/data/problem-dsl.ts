export const PIPELINE_BEFORE = `@page 16:9

flow direction:right {
  node "LLM" #llm
  node "JSON\\nParser" #parse
  node "Template\\nEngine" #tmpl
  node "Headless\\nBrowser" #browser
  node "Screenshot\\nAPI" #capture
  pill "PNG" #out

  #llm -> #parse -> #tmpl -> #browser -> #capture -> #out
}`;

export const PIPELINE_AFTER = `@page 16:9

flow direction:right {
  node "LLM" #llm { background: primary }
  node "Depix\\nDSL" #dsl { background: accent }
  pill "Visual" #out { background: success }

  #llm -> #dsl "text"
  #dsl -> #out "compile()"
}`;

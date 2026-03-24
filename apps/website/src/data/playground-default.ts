export const PLAYGROUND_DEFAULT = `@page 16:9

flow direction:right {
  pill "Start" #start { background: primary }
  node "Process" #proc
  diamond "OK?" #check
  pill "Done" #end { background: success }
  node "Fix" #fix { background: warning }

  #start -> #proc -> #check
  #check -> #end "Yes"
  #check -> #fix "No"
  #fix -> #proc
}`;

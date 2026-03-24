export interface ExampleTab {
  id: string;
  prompt_key: 'flowchart' | 'slides' | 'dashboard' | 'architecture';
  dsl: string;
}

export const EXAMPLE_TABS: ExampleTab[] = [
  {
    id: 'flowchart',
    prompt_key: 'flowchart',
    dsl: `@page 16:9

flow direction:down {
  pill "Start" #start { background: primary }
  node "Enter Email" #email
  node "Send Verification" #send
  diamond "Verified?" #check
  node "Create Account" #create
  pill "Done" #end { background: success }
  node "Retry" #retry { background: warning }

  #start -> #email
  #email -> #send
  #send -> #check
  #check -> #create "Yes"
  #check -> #retry "No"
  #retry -> #send
  #create -> #end
}`,
  },
  {
    id: 'slides',
    prompt_key: 'slides',
    dsl: `@page 16:9

scene "Q3 Overview" {
  layout: header
  header: heading "Q3 2025 Results"
  body: stack direction:row {
    stat "23%" { label: "Revenue Growth" }
    stat "$4.2M" { label: "Total Revenue" }
    stat "1,847" { label: "New Users" }
  }
}

scene "Highlights" {
  layout: header
  header: heading "Key Highlights"
  body: bullet ["Launched enterprise tier — 120% ARR increase", "Mobile app reached 50K downloads", "Infrastructure cost reduced by 35%", "NPS score improved from 42 to 67"]
}

scene "Next Steps" {
  layout: header
  header: heading "Q4 Roadmap"
  body: flow direction:right {
    node "API v2" #a { background: primary }
    node "SDK Release" #b { background: accent }
    node "Global Launch" #c { background: success }
    #a -> #b -> #c
  }
}`,
  },
  {
    id: 'dashboard',
    prompt_key: 'dashboard',
    dsl: `@page 16:9

scene "System Dashboard" {
  layout: header-grid
  header: heading "System Monitor"
  cell: stat "99.9%" { label: "Uptime" }
  cell: stat "42ms" { label: "Avg Latency" }
  cell: stat "2.1K" { label: "RPS" }
  cell: stat "12" { label: "Active Nodes" }
}`,
  },
  {
    id: 'architecture',
    prompt_key: 'architecture',
    dsl: `@page 16:9

scene "Architecture" {
  layout: full
  body: layers {
    layer "Client" {
      node "Web App"
      node "Mobile App"
      node "CLI"
    }
    layer "API Gateway" {
      node "Load Balancer"
      node "Auth"
      node "Rate Limit"
    }
    layer "Services" {
      node "User Service"
      node "Order Service"
      node "Notification"
    }
    layer "Data" {
      cylinder "PostgreSQL"
      cylinder "Redis"
      cylinder "S3"
    }
  }
}`,
  },
];

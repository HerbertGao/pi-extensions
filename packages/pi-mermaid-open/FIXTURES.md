## Mermaid diagram test matrix

These fixtures cover the Mermaid diagram types supported by the current Mermaid documentation. The two flowcharts test vertical and horizontal layouts.

### Flowchart (vertical)

```mermaid
flowchart TD
  Start([Start]) --> Ready{Ready?}
  Ready -->|Yes| Done([Done])
  Ready -->|No| Wait[Wait]
  Wait --> Ready
```

### Flowchart (horizontal)

```mermaid
flowchart LR
  A[01] --> B[02] --> C[03] --> D[04] --> E[05] --> F[06]
  F --> G[07] --> H[08] --> I[09] --> J[10] --> K[11] --> L[12]
```

### Sequence diagram

```mermaid
sequenceDiagram
  actor User
  participant API
  User->>API: Request
  API-->>User: Response
```

### Class diagram

```mermaid
classDiagram
  class User {
    +string name
    +login()
  }
  User --> Session
```

### State diagram

```mermaid
stateDiagram-v2
  [*] --> Draft
  Draft --> Published: approve
  Published --> [*]
```

### Entity relationship diagram

```mermaid
erDiagram
  USER ||--o{ ORDER : places
  ORDER ||--|{ ITEM : contains

  USER {
    int id PK
    string email
  }
  ORDER {
    int id PK
    int user_id FK
  }
```

### User journey

```mermaid
journey
  title Checkout
  section Cart
    Add item: 5: User
    Review cart: 4: User
```

### Gantt chart

```mermaid
gantt
  title Release plan
  dateFormat YYYY-MM-DD
  section Build
    Implement :done, implement, 2025-01-01, 2d
    Test :test, after implement, 2d
```

### Pie chart

```mermaid
pie title Traffic
  "Direct" : 40
  "Search" : 60
```

### Quadrant chart

```mermaid
quadrantChart
  title Reach and effort
  x-axis Low effort --> High effort
  y-axis Low reach --> High reach
  quadrant-1 Do next
  quadrant-2 Plan
  quadrant-3 Skip
  quadrant-4 Delegate
  Feature A: [0.8, 0.7]
  Feature B: [0.2, 0.3]
```

### Requirement diagram

```mermaid
requirementDiagram
  requirement login {
    id: 1
    text: Users can log in
    risk: low
    verifymethod: test
  }
  element app {
    type: system
  }
  app - satisfies -> login
```

### Git graph

```mermaid
gitGraph
  commit
  branch feature
  checkout feature
  commit
  checkout main
  merge feature
```

### C4 diagram

```mermaid
C4Context
  title System context
  Person(user, "User", "Uses the app")
  System(app, "App", "Serves requests")
  Rel(user, app, "Uses")
```

### Mindmap

```mermaid
mindmap
  root((Project))
    Plan
      Scope
    Build
      Code
```

### Timeline

```mermaid
timeline
  title Project
  2025 : Start
  2026 : Release
```

### ZenUML sequence diagram

```mermaid
zenuml
  Alice->Bob: Hello
  Bob->Alice: Hi
```

### Sankey diagram

```mermaid
sankey-beta
  Source,Target,10
  Target,Done,10
```

### XY chart

```mermaid
xychart-beta
  title "Scores"
  x-axis [A, B, C]
  y-axis "Value" 0 --> 10
  bar [3, 7, 5]
  line [2, 6, 8]
```

### Block diagram

```mermaid
block-beta
  columns 3
  A["Input"] B["Process"] C["Output"]
  A --> B
  B --> C
```

### Packet diagram

```mermaid
packet-beta
  0-3: "Version"
  4-7: "Flags"
  8-15: "Length"
  16-31: "Payload"
```

### Kanban diagram

```mermaid
kanban
  Backlog
    task1[Write docs]
  Done
    task2[Ship release]
```

### Architecture diagram

```mermaid
architecture-beta
  service internet(internet)[Internet]
  service server(server)[Server]
  internet:B --> T:server
```

### Radar chart

```mermaid
radar-beta
  title Team skills
  axis Speed, Quality, Docs, Ops
  curve Current { 4, 5, 3, 2 }
  max 5
```

### Treemap

```mermaid
treemap-beta
  "Product"
    "Core": 60
    "Docs": 40
  "Operations"
    "CI": 30
```

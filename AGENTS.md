<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Intelligent Routing

**Automatic Skill Selection Enabled**

I am configured with automatic specialist skill selection. When you ask me to do something, I will automatically select the most appropriate skill based on your request:

## Auto-Invocation Matrix

| Your Request Contains... | Skill Invoked | My Action |
|--------------------------|---------------|-----------|
| `login`, `auth`, `token`, `security`, `vulnerability` | `@security-auditor` + `@nextjs-react-expert` | Security review + Next.js optimization |
| `button`, `card`, `component`, `style`, `design`, `tailwind` | `@frontend-design` | UI/UX design with Tailwind |
| `api`, `route`, `endpoint`, `POST`, `GET` | `@nextjs-react-expert` | Next.js API route optimization |
| `database`, `schema`, `query`, `mssql`, `stored procedure` | `@nextjs-react-expert` | Data fetching and database performance |
| `test`, `coverage`, `playwright`, `e2e` | `@webapp-testing` | Test coverage and e2e testing |
| `slow`, `optimize`, `performance`, `waterfall` | `@nextjs-react-expert` | Next.js performance optimization (57 rules) |
| `understand`, `map`, `explain my codebase`, `knowledge graph` | `@graphify` | Build knowledge graph of your project |

## Explicit Skill Usage

You can also explicitly invoke skills:
```
@graphify explain my guest request flow
@nextjs-react-expert review my API route for performance
@frontend-design help me design a new form component
```

## Available Skills in This Project

| Category | Skill | Purpose |
|----------|-------|---------|
| Knowledge Graph | `@graphify` | Turn codebase into navigable knowledge graph |
| Next.js/React | `@nextjs-react-expert` | Performance optimization, waterfalls, bundle size |
| Intelligent Routing | `@intelligent-routing` | Auto-select best specialist skill |

---

**Note**: Skills are loaded from `.claude/skills/`. The system automatically analyzes your prompts and applies the most relevant expertise.

# @fittrack/mcp-server

An [MCP](https://modelcontextprotocol.io) server that exposes a FitTrack Pro account — profile, workouts,
nutrition, weight/activity (including anything synced from Apple Health or imported from MacroFactor), and
long-term coaching memory — to any MCP-compatible LLM client (Claude Desktop, Claude Code, ChatGPT connectors,
etc.), and lets that LLM take the same coaching actions the in-app AI coach can.

It's a thin stdio server: every tool call proxies to your FitTrack Pro deployment's `/api/mcp/*` REST endpoints
over HTTPS, authenticated with a personal access token. No FitTrack data is stored by this package itself.

## Setup

1. In the FitTrack Pro app, go to **Settings → Connect an AI (MCP)** and generate a personal access token.

### Claude.ai (web)

Claude.ai's web connectors can't spawn a local process, so they need a remote HTTP endpoint instead of this stdio
package. The main app exposes one directly at `/api/mcp` (Streamable HTTP transport, same tools, same token). In
Claude.ai go to **Settings → Connectors → Add custom connector** and use `https://your-app.vercel.app/api/mcp` with
`Authorization: Bearer <your token>`.

### Claude Desktop / Claude Code

2. Build this package (from the repo root): `npm run build --workspace=@fittrack/mcp-server`.
3. Point your MCP client at it with two environment variables:
   - `FITTRACK_BASE_URL` — your deployed FitTrack Pro origin (e.g. `https://your-app.vercel.app`)
   - `FITTRACK_API_TOKEN` — the token from step 1

```json
{
  "mcpServers": {
    "fittrack": {
      "command": "node",
      "args": ["/absolute/path/to/packages/mcp-server/dist/index.js"],
      "env": {
        "FITTRACK_BASE_URL": "https://your-app.vercel.app",
        "FITTRACK_API_TOKEN": "ftmcp_..."
      }
    }
  }
}
```

Or, once published: `"command": "npx", "args": ["-y", "@fittrack/mcp-server"]`.

## Tools

| Tool | What it does |
| --- | --- |
| `get_fittrack_summary` | One-call snapshot: profile, current nutrition targets, recent workouts, food log, weight/activity, active transformation challenge, coaching memory. Call this first. |
| `get_coach_memory` | Full accumulated coaching memory (preferences, constraints, insights, past actions, outcomes). |
| `set_nutrition_targets` | Sets real daily calorie/macro targets — overrides the app's auto-calculated targets everywhere. |
| `schedule_workout_plan` | Generates and saves the upcoming week's workouts to the training log. |
| `save_coaching_instructions` | Persists workout intensity/exercise overrides that affect future generated workouts. |
| `set_ai_coach_goal` | Switches the account into AI Coach Mode with a freeform goal, which becomes the source of truth for nutrition/training instead of a fixed preset. |
| `remember_insight` | Writes a durable fact (preference, constraint, outcome) to long-term coaching memory, shared with the in-app coach and every other connected MCP client. |

Because memory writes land in the same `CoachMemory` table the in-app chat reads from, advice compounds across
every surface — the FitTrack Pro app, Claude, ChatGPT, or anything else you connect — instead of resetting per client.

## Security

Tokens are personal access tokens scoped to one FitTrack Pro account, generated and revocable from
**Settings → Connect an AI (MCP)**. Only a SHA-256 hash is stored server-side; the plaintext token is shown once
at generation time. Treat it like a password — anyone holding it can read and modify that account's fitness data.

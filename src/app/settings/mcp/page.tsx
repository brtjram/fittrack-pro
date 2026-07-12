'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/header';
import { Bot, Copy, Check, Trash2, Plus, ShieldAlert } from 'lucide-react';

interface ApiTokenSummary {
  id: string;
  name: string;
  lastUsedAt: string | null;
  createdAt: string;
}

export default function McpSettingsPage() {
  const [tokens, setTokens] = useState<ApiTokenSummary[]>([]);
  const [newTokenName, setNewTokenName] = useState('');
  const [mintedToken, setMintedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [appUrl, setAppUrl] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setAppUrl(window.location.origin);
    refreshTokens();
  }, []);

  const refreshTokens = async () => {
    const res = await fetch('/api/mcp/tokens');
    if (res.ok) setTokens(await res.json());
  };

  const createToken = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/mcp/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTokenName || 'MCP client' }),
      });
      if (res.ok) {
        const data = await res.json();
        setMintedToken(data.token);
        setNewTokenName('');
        await refreshTokens();
      }
    } finally {
      setCreating(false);
    }
  };

  const revokeToken = async (id: string) => {
    await fetch(`/api/mcp/tokens/${id}`, { method: 'DELETE' });
    await refreshTokens();
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const configSnippet = JSON.stringify(
    {
      mcpServers: {
        fittrack: {
          command: 'npx',
          args: ['-y', '@fittrack/mcp-server'],
          env: {
            FITTRACK_BASE_URL: appUrl || 'https://your-fittrack-domain.com',
            FITTRACK_API_TOKEN: mintedToken || 'YOUR_TOKEN_HERE',
          },
        },
      },
    },
    null,
    2,
  );

  return (
    <div className="min-h-screen">
      <Header title="Connect an AI (MCP)" showBack />

      <div className="mx-auto max-w-lg space-y-6 p-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-3">
              <Bot className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold">Give any LLM your FitTrack data</h2>
              <p className="text-sm text-muted-foreground">
                FitTrack Pro ships an MCP server, so Claude, ChatGPT, or any MCP-compatible client can read your
                profile, workouts, nutrition, weight/activity, and coaching memory — and take the same coaching
                actions your in-app coach can.
              </p>
            </div>
          </div>
        </div>

        {/* Step 1: token */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</div>
            <h3 className="font-semibold">Generate an access token</h3>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={newTokenName}
              onChange={(e) => setNewTokenName(e.target.value)}
              placeholder="Name (e.g. Claude Desktop)"
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              onClick={createToken}
              disabled={creating}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Generate
            </button>
          </div>

          {mintedToken && (
            <div className="mt-3 rounded-lg border border-warning/30 bg-warning/5 p-3">
              <div className="flex items-start gap-2">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <p className="text-xs text-muted-foreground">
                  Copy this now — it won&apos;t be shown again. Anyone with this token can read and modify this account&apos;s fitness data.
                </p>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 overflow-x-auto rounded-lg bg-muted px-3 py-2 font-mono text-xs">
                  {mintedToken}
                </code>
                <button
                  onClick={() => copyToClipboard(mintedToken, 'token')}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary hover:bg-primary/20"
                >
                  {copied === 'token' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          {tokens.length > 0 && (
            <div className="mt-4 space-y-2">
              {tokens.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2">
                  <div>
                    <div className="text-sm font-medium">{t.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {t.lastUsedAt ? `Last used ${new Date(t.lastUsedAt).toLocaleDateString()}` : 'Never used'}
                    </div>
                  </div>
                  <button
                    onClick={() => revokeToken(t.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title="Revoke"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Step 2: config */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</div>
            <h3 className="font-semibold">Add it to your AI client</h3>
          </div>
          <p className="mb-3 text-sm text-muted-foreground">
            For Claude Desktop or Claude Code, add this to your MCP config (or run{' '}
            <code className="rounded bg-muted px-1">claude mcp add fittrack</code>). Other MCP clients (including
            ChatGPT&apos;s custom connectors, once you have a token) use the same base URL and bearer token against
            the REST endpoints directly.
          </p>
          <div className="relative">
            <pre className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs">{configSnippet}</pre>
            <button
              onClick={() => copyToClipboard(configSnippet, 'config')}
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg bg-background/80 text-muted-foreground hover:text-foreground"
            >
              {copied === 'config' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* What it exposes */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-2 font-semibold">What the AI can see and do</h3>
          <ul className="ml-4 list-disc space-y-1 text-sm text-muted-foreground">
            <li>Full profile, current nutrition targets, and AI Coach goal (if set)</li>
            <li>Recent workouts, food log, weight, and daily activity — including anything synced from Apple Health or imported from MacroFactor</li>
            <li>Accumulated coaching memory: preferences, constraints, and outcomes learned over time</li>
            <li>Can set nutrition targets, schedule workouts, save training instructions, set an AI Coach goal, and write new coaching memory — the same actions the in-app coach takes</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

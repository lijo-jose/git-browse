'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useDangerZone } from '@/lib/dangerZone';

interface RemoteInfo { name: string; fetchUrl: string; pushUrl: string; }
interface GitIdentity {
  name: string;
  email: string;
  nameScope: 'local' | 'global' | 'unset';
  emailScope: 'local' | 'global' | 'unset';
}

type Tab = 'identity' | 'remotes' | 'security';

interface Props {
  repo: string;
  onClose: () => void;
}

export default function RepoSettingsModal({ repo, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('identity');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-[480px] max-h-[80vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--bg-panel)', border: '1px solid color-mix(in oklch, var(--border-subtle) 80%, transparent)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-soft)' }}>
              <circle cx="8" cy="8" r="2.5"/>
              <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M3.05 12.95l1.06-1.06M11.89 4.11l1.06-1.06"/>
            </svg>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Repository Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-md transition-colors"
            style={{ color: 'var(--text-dim)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'color-mix(in oklch, var(--bg-raised) 80%, transparent)'; (e.currentTarget as HTMLElement).style.color = 'var(--foreground)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = 'var(--text-dim)'; }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M1 1l10 10M11 1L1 11"/>
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pb-3 flex-shrink-0" style={{ borderBottom: '1px solid color-mix(in oklch, var(--border-subtle) 50%, transparent)' }}>
          {([
            ['identity', 'Git Identity'],
            ['remotes', 'Remotes'],
            ['security', 'Security'],
          ] as [Tab, string][]).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                background: tab === t ? 'color-mix(in oklch, var(--bg-raised) 90%, transparent)' : 'transparent',
                color: tab === t ? 'var(--foreground)' : 'var(--text-dim)',
                border: tab === t ? '1px solid color-mix(in oklch, var(--border-subtle) 60%, transparent)' : '1px solid transparent',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {tab === 'identity' && <IdentityTab repo={repo} />}
          {tab === 'remotes' && <RemotesTab repo={repo} />}
          {tab === 'security' && <SecurityTab />}
        </div>
      </div>
    </div>
  );
}

// ── Identity tab ──────────────────────────────────────────────────────────────

function IdentityTab({ repo }: { repo: string }) {
  const [identity, setIdentity] = useState<GitIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [scope, setScope] = useState<'local' | 'global'>('local');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/git/config?repo=${encodeURIComponent(repo)}`)
      .then(r => r.json())
      .then(d => {
        if (!d.error) {
          setIdentity(d);
          setName(d.name);
          setEmail(d.email);
        }
      })
      .finally(() => setLoading(false));
  }, [repo]);

  async function save() {
    setSaving(true);
    try {
      const results = await Promise.all([
        fetch('/api/git/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ repo, key: 'user.name', value: name, scope }) }).then(r => r.json()),
        fetch('/api/git/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ repo, key: 'user.email', value: email, scope }) }).then(r => r.json()),
      ]);
      const err = results.find(r => r.error);
      if (err) { toast.error(err.error); return; }
      toast.success('Identity saved');
      const updated = await fetch(`/api/git/config?repo=${encodeURIComponent(repo)}`).then(r => r.json());
      if (!updated.error) setIdentity(updated);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-5 text-xs" style={{ color: 'var(--text-dim)' }}>Loading…</div>;

  const scopeColor = (s: 'local' | 'global' | 'unset') =>
    s === 'local' ? 'oklch(0.74 0.17 150)' : s === 'global' ? 'oklch(0.65 0.18 250)' : 'var(--text-dim)';

  return (
    <div className="p-5 space-y-5">
      {/* Current values */}
      {identity && (
        <div className="rounded-xl p-3 space-y-2" style={{ background: 'color-mix(in oklch, var(--bg-raised) 50%, transparent)', border: '1px solid color-mix(in oklch, var(--border-subtle) 50%, transparent)' }}>
          <p className="text-[10px] font-semibold tracking-widest uppercase mb-2" style={{ color: 'var(--text-dim)' }}>Current</p>
          {(['name', 'email'] as const).map(k => {
            const val = identity[k];
            const sc = identity[`${k}Scope`];
            const c = scopeColor(sc);
            return (
              <div key={k} className="flex items-center gap-2">
                <span className="text-[10px] w-10 flex-shrink-0 capitalize font-medium" style={{ color: 'var(--text-dim)' }}>{k}</span>
                <span className="text-xs font-mono flex-1 truncate" style={{ color: val ? 'var(--foreground)' : 'var(--text-dim)' }}>{val || '—'}</span>
                {sc !== 'unset' && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0" style={{ background: `color-mix(in oklch, ${c} 15%, transparent)`, color: c }}>{sc}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit form */}
      <div className="space-y-3">
        <p className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--text-dim)' }}>Update</p>
        <FormField label="Name" value={name} onChange={setName} placeholder="Your name" />
        <FormField label="Email" value={email} onChange={setEmail} placeholder="your@email.com" type="email" />

        <div className="flex items-center gap-3 pt-1">
          <span className="text-xs" style={{ color: 'var(--text-soft)' }}>Save to</span>
          <ScopeToggle value={scope} onChange={setScope} />
          <div className="flex-1" />
          <button
            onClick={save}
            disabled={saving}
            className="h-8 px-4 rounded-lg text-xs font-medium transition-opacity"
            style={{ background: 'oklch(0.55 0.18 250)', color: '#fff', opacity: saving ? 0.6 : 1 }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>

        <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-dim)' }}>
          <strong>Local</strong> overrides only this repository. <strong>Global</strong> applies to all repos on this machine.
        </p>
      </div>
    </div>
  );
}

// ── Remotes tab ───────────────────────────────────────────────────────────────

function RemotesTab({ repo }: { repo: string }) {
  const [remotes, setRemotes] = useState<RemoteInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch(`/api/git/info?repo=${encodeURIComponent(repo)}`)
      .then(r => r.json())
      .then(d => { if (!d.error) setRemotes(d.remotes ?? []); })
      .finally(() => setLoading(false));
  };

  useEffect(load, [repo]);

  if (loading) return <div className="p-5 text-xs" style={{ color: 'var(--text-dim)' }}>Loading…</div>;

  return (
    <div className="p-5 space-y-3">
      {remotes.length === 0 && !adding && (
        <p className="text-xs" style={{ color: 'var(--text-dim)' }}>No remotes configured.</p>
      )}

      {remotes.map(r => (
        editingName === r.name
          ? <EditRemoteCard key={r.name} repo={repo} remote={r} onDone={() => { setEditingName(null); load(); }} onCancel={() => setEditingName(null)} />
          : <RemoteCard key={r.name} repo={repo} remote={r} onEdit={() => setEditingName(r.name)} onDeleted={load} />
      ))}

      {adding
        ? <AddRemoteCard repo={repo} onDone={() => { setAdding(false); load(); }} onCancel={() => setAdding(false)} />
        : (
          <button
            onClick={() => setAdding(true)}
            className="w-full flex items-center justify-center gap-2 h-9 rounded-xl text-xs font-medium transition-colors"
            style={{ border: '1px dashed color-mix(in oklch, var(--border-subtle) 80%, transparent)', color: 'var(--text-dim)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--foreground)'; (e.currentTarget as HTMLElement).style.borderColor = 'color-mix(in oklch, var(--border-subtle) 120%, transparent)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-dim)'; (e.currentTarget as HTMLElement).style.borderColor = 'color-mix(in oklch, var(--border-subtle) 80%, transparent)'; }}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 1v10M1 6h10"/>
            </svg>
            Add remote
          </button>
        )
      }
    </div>
  );
}

function RemoteCard({ repo, remote, onEdit, onDeleted }: { repo: string; remote: RemoteInfo; onEdit: () => void; onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false);

  async function handleDelete() {
    if (!confirming) { setConfirming(true); return; }
    const res = await fetch('/api/git/remote', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ repo, name: remote.name }) }).then(r => r.json());
    if (res.error) toast.error(res.error);
    else { toast.success(`Removed remote "${remote.name}"`); onDeleted(); }
  }

  return (
    <div className="rounded-xl p-3" style={{ background: 'color-mix(in oklch, var(--bg-raised) 50%, transparent)', border: '1px solid color-mix(in oklch, var(--border-subtle) 50%, transparent)' }}>
      <div className="flex items-center gap-2 mb-2">
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'oklch(0.78 0.14 80 / 0.7)' }} />
        <span className="text-xs font-semibold flex-1" style={{ color: 'var(--foreground)' }}>{remote.name}</span>
        <button onClick={onEdit} className="text-[10px] px-2 py-1 rounded-md transition-colors" style={{ color: 'var(--text-soft)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'color-mix(in oklch, var(--bg-raised) 80%, transparent)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}>
          Edit
        </button>
        <button
          onClick={handleDelete}
          onBlur={() => setConfirming(false)}
          className="text-[10px] px-2 py-1 rounded-md transition-colors"
          style={{ color: confirming ? 'oklch(0.65 0.2 25)' : 'var(--text-soft)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'color-mix(in oklch, var(--bg-raised) 80%, transparent)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}
        >
          {confirming ? 'Sure?' : 'Remove'}
        </button>
      </div>
      {remote.fetchUrl && (
        <p className="text-[10px] font-mono truncate pl-3.5" style={{ color: 'var(--text-dim)' }} title={remote.fetchUrl}>{remote.fetchUrl}</p>
      )}
      {remote.pushUrl && remote.pushUrl !== remote.fetchUrl && (
        <p className="text-[10px] font-mono truncate pl-3.5 mt-0.5" style={{ color: 'var(--text-dim)' }} title={remote.pushUrl}>push: {remote.pushUrl}</p>
      )}
    </div>
  );
}

function EditRemoteCard({ repo, remote, onDone, onCancel }: { repo: string; remote: RemoteInfo; onDone: () => void; onCancel: () => void }) {
  const [url, setUrl] = useState(remote.fetchUrl);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!url.trim()) return;
    setSaving(true);
    const res = await fetch('/api/git/remote', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ repo, name: remote.name, url: url.trim() }) }).then(r => r.json());
    setSaving(false);
    if (res.error) toast.error(res.error);
    else { toast.success(`Updated "${remote.name}"`); onDone(); }
  }

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: 'color-mix(in oklch, var(--bg-raised) 50%, transparent)', border: '1px solid color-mix(in oklch, oklch(0.55 0.18 250) 40%, var(--border-subtle))' }}>
      <p className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>{remote.name}</p>
      <FormField label="URL" value={url} onChange={setUrl} placeholder="https://github.com/org/repo.git" />
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="h-7 px-3 rounded-lg text-xs" style={{ color: 'var(--text-soft)' }}>Cancel</button>
        <button onClick={save} disabled={saving || !url.trim()} className="h-7 px-4 rounded-lg text-xs font-medium" style={{ background: 'oklch(0.55 0.18 250)', color: '#fff', opacity: saving || !url.trim() ? 0.6 : 1 }}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

function AddRemoteCard({ repo, onDone, onCancel }: { repo: string; onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim() || !url.trim()) return;
    setSaving(true);
    const res = await fetch('/api/git/remote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ repo, name: name.trim(), url: url.trim() }) }).then(r => r.json());
    setSaving(false);
    if (res.error) toast.error(res.error);
    else { toast.success(`Added remote "${name}"`); onDone(); }
  }

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: 'color-mix(in oklch, var(--bg-raised) 50%, transparent)', border: '1px solid color-mix(in oklch, oklch(0.55 0.18 250) 40%, var(--border-subtle))' }}>
      <p className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>New remote</p>
      <FormField label="Name" value={name} onChange={setName} placeholder="origin" />
      <FormField label="URL" value={url} onChange={setUrl} placeholder="https://github.com/org/repo.git" />
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="h-7 px-3 rounded-lg text-xs" style={{ color: 'var(--text-soft)' }}>Cancel</button>
        <button onClick={save} disabled={saving || !name.trim() || !url.trim()} className="h-7 px-4 rounded-lg text-xs font-medium" style={{ background: 'oklch(0.55 0.18 250)', color: '#fff', opacity: saving || !name.trim() || !url.trim() ? 0.6 : 1 }}>
          {saving ? 'Adding…' : 'Add'}
        </button>
      </div>
    </div>
  );
}

// ── Security tab ─────────────────────────────────────────────────────────────

function SecurityTab() {
  const { unlocked, lock, unlock } = useDangerZone();

  return (
    <div className="p-5 space-y-4">
      <div
        className="rounded-xl p-4 flex items-start gap-4"
        style={{ background: 'color-mix(in oklch, var(--bg-raised) 50%, transparent)', border: `1px solid ${unlocked ? 'color-mix(in oklch, oklch(0.72 0.16 70) 35%, var(--border-subtle))' : 'color-mix(in oklch, var(--border-subtle) 50%, transparent)'}` }}
      >
        {/* Lock icon */}
        <div className="flex-shrink-0 mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: unlocked ? 'color-mix(in oklch, oklch(0.72 0.16 70) 12%, transparent)' : 'color-mix(in oklch, var(--bg-raised) 80%, transparent)' }}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: unlocked ? 'oklch(0.72 0.16 70)' : 'var(--text-dim)' }}>
            {unlocked ? (
              <>
                <rect x="3" y="7" width="10" height="8" rx="1.5"/>
                <path d="M5 7V4.5a3 3 0 015.83-1"/>
              </>
            ) : (
              <>
                <rect x="3" y="7" width="10" height="8" rx="1.5"/>
                <path d="M5 7V5a3 3 0 016 0v2"/>
              </>
            )}
          </svg>
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>
            Danger zone is <span style={{ color: unlocked ? 'oklch(0.72 0.16 70)' : 'oklch(0.74 0.17 150)' }}>{unlocked ? 'unlocked' : 'locked'}</span>
          </p>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-dim)' }}>
            {unlocked
              ? 'Remote operations (push, pull) run without a confirmation dialog. Lock it to require explicit confirmation each time.'
              : 'Remote operations (push, pull) require confirmation before running. Unlock to skip those dialogs.'}
          </p>
        </div>
      </div>

      <button
        onClick={unlocked ? lock : unlock}
        className="w-full h-9 rounded-xl text-xs font-medium transition-colors"
        style={unlocked
          ? { background: 'color-mix(in oklch, oklch(0.72 0.16 70) 12%, transparent)', color: 'oklch(0.72 0.16 70)', border: '1px solid color-mix(in oklch, oklch(0.72 0.16 70) 30%, transparent)' }
          : { background: 'color-mix(in oklch, var(--bg-raised) 80%, transparent)', color: 'var(--text-soft)', border: '1px solid color-mix(in oklch, var(--border-subtle) 60%, transparent)' }
        }
      >
        {unlocked ? 'Lock danger zone' : 'Unlock danger zone'}
      </button>

      <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-dim)' }}>
        This setting is persisted in your browser. The lock icon in the toolbar shows the current state at a glance.
      </p>
    </div>
  );
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function FormField({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs w-10 flex-shrink-0 font-medium" style={{ color: 'var(--text-dim)' }}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 h-8 px-3 rounded-lg text-xs font-mono outline-none"
        style={{ background: 'color-mix(in oklch, var(--bg-raised) 80%, transparent)', color: 'var(--foreground)', border: '1px solid color-mix(in oklch, var(--border-subtle) 60%, transparent)' }}
        onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = 'oklch(0.55 0.18 250)'; }}
        onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'color-mix(in oklch, var(--border-subtle) 60%, transparent)'; }}
      />
    </div>
  );
}

function ScopeToggle({ value, onChange }: { value: 'local' | 'global'; onChange: (v: 'local' | 'global') => void }) {
  return (
    <div className="flex rounded-lg overflow-hidden text-xs" style={{ border: '1px solid color-mix(in oklch, var(--border-subtle) 60%, transparent)' }}>
      {(['local', 'global'] as const).map(s => (
        <button
          key={s}
          onClick={() => onChange(s)}
          className="px-3 py-1 transition-colors capitalize"
          style={{
            background: value === s ? 'oklch(0.55 0.18 250)' : 'transparent',
            color: value === s ? '#fff' : 'var(--text-soft)',
          }}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

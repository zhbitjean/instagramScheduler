'use client';

import { useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, CalendarDays, Camera, Check, ChevronDown, CircleHelp, Clock3, FolderCheck, FolderInput, FolderOpen, GripVertical, ImagePlus, Link2, MoreHorizontal, Play, Plus, RefreshCw, Send, Settings, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type MediaItem = { id: number | string; name: string; src: string; type: 'Photo' | 'Video'; duration?: string; path?: string };
type InstagramAccount = { id: string; username: string };

const sampleMedia: MediaItem[] = [
  { id: 1, name: 'Sunset walk.jpg', src: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=720&q=85', type: 'Photo' },
  { id: 2, name: 'Morning coffee.jpg', src: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=720&q=85', type: 'Photo' },
  { id: 3, name: 'Studio details.mp4', src: 'https://images.unsplash.com/photo-1497215842964-222b430dc094?auto=format&fit=crop&w=720&q=85', type: 'Video', duration: '0:18' },
  { id: 4, name: 'Weekend market.jpg', src: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=720&q=85', type: 'Photo' },
  { id: 5, name: 'Golden hour.jpg', src: 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=720&q=85', type: 'Photo' },
  { id: 6, name: 'City notes.jpg', src: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&w=720&q=85', type: 'Photo' },
];

export default function Home() {
  const [media, setMedia] = useState(sampleMedia);
  const [frequency, setFrequency] = useState(2);
  const [times, setTimes] = useState(['8:00 AM', '10:00 AM', '12:00 PM']);
  const [caption, setCaption] = useState('A little moment from the week ✨\n\nTaking time to notice the good stuff. #everydaymagic #slowliving');
  const [saved, setSaved] = useState(false);
  const [draggedId, setDraggedId] = useState<number | string | null>(null);
  const [mediaRoot, setMediaRoot] = useState('C:\\Instagram\\READY');
  const [doneRoot, setDoneRoot] = useState('C:\\Instagram\\READY\\DONE');
  const [folderStatus, setFolderStatus] = useState('Local service not connected');
  const [accountStatus, setAccountStatus] = useState<'missing' | 'ready'>('missing');
  const [accountMessage, setAccountMessage] = useState('Connect your Instagram Professional account.');
  const [instagramUsername, setInstagramUsername] = useState('');
  const [instagramAccounts, setInstagramAccounts] = useState<InstagramAccount[]>([]);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [metaSetupOpen, setMetaSetupOpen] = useState(false);
  const [metaAppId, setMetaAppId] = useState('');
  const [metaAppSecret, setMetaAppSecret] = useState('');
  const [metaRedirectUri, setMetaRedirectUri] = useState('');
  const [selected, setSelected] = useState<Set<number | string>>(new Set());
  const [menuId, setMenuId] = useState<number | string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const scheduled = useMemo(() => media.slice(0, 4).map((item, index) => ({ item, day: index < times.length ? 'Tue, Sep 1' : 'Thu, Sep 3', time: times[index % times.length] ?? '12:00 PM' })), [media, times]);

  function move(id: number | string, direction: -1 | 1) {
    setMedia((current) => { const index = current.findIndex((item) => item.id === id); const next = index + direction; if (index < 0 || next < 0 || next >= current.length) return current; const copy = [...current]; [copy[index], copy[next]] = [copy[next], copy[index]]; return copy; });
  }
  function dropOn(targetId: number | string) {
    if (draggedId === null || draggedId === targetId) return;
    setMedia((current) => { const from = current.findIndex((item) => item.id === draggedId); const to = current.findIndex((item) => item.id === targetId); const copy = [...current]; const [picked] = copy.splice(from, 1); copy.splice(to, 0, picked); return copy; }); setDraggedId(null);
  }
  function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const added = Array.from(files).map((file, index) => ({ id: Date.now() + index, name: file.name, src: URL.createObjectURL(file), type: file.type.startsWith('video/') ? 'Video' as const : 'Photo' as const })); setMedia((current) => [...current, ...added]);
  }

  async function scanFolder() {
    try {
      setFolderStatus('Connecting to local folder service…');
      const configured = await fetch('http://127.0.0.1:3030/configure', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mediaRoot, doneRoot }) });
      const configuredBody = await configured.json();
      if (!configured.ok) throw new Error(configuredBody.error);
      const response = await fetch('http://127.0.0.1:3030/scan');
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setMedia(body.files);
      setMediaRoot(body.mediaRoot);
      setDoneRoot(body.doneRoot);
      setFolderStatus(`${body.files.length} files loaded · DONE archive ready`);
    } catch (error) {
      setFolderStatus(error instanceof Error ? error.message : 'Could not connect to the local folder service.');
    }
  }

  async function chooseFolder(kind: 'source' | 'done') {
    try {
      setFolderStatus('Opening Windows folder chooser…');
      const response = await fetch('http://127.0.0.1:3030/pick-folder', { method: 'POST' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      if (body.cancelled) { setFolderStatus('Folder selection cancelled.'); return; }
      if (kind === 'source') {
        setMediaRoot(body.path);
        setDoneRoot(`${body.path}\\DONE`);
      } else {
        setDoneRoot(body.path);
      }
      setFolderStatus('Folder selected. Click Connect & scan folder.');
    } catch (error) {
      setFolderStatus(error instanceof Error ? error.message : 'Could not open the folder chooser.');
    }
  }

  function toggleSelected(id: number | string) {
    setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  function removeItems(ids: Set<number | string>) {
    setMedia((current) => current.filter((item) => !ids.has(item.id)));
    setSelected(new Set());
    setMenuId(null);
  }

  async function refreshInstagramStatus() {
    try {
      const response = await fetch('http://127.0.0.1:3030/instagram/status');
      const body = await response.json();
      setInstagramAccounts(body.accounts || []);
      setMetaRedirectUri(body.redirectUri || '');
      if (body.connected) { setAccountStatus('ready'); setInstagramUsername(body.account.username); setAccountMessage('Professional account selected.'); }
      else { setAccountStatus('missing'); setInstagramUsername(''); setAccountMessage(body.configured ? 'Choose Add another account to sign in with Meta.' : 'Meta app setup is required before your first sign-in.'); }
    } catch {
      setAccountMessage('Start the Postflow local service before connecting Instagram.');
    }
  }

  async function connectInstagram() {
    try {
      const statusResponse = await fetch('http://127.0.0.1:3030/instagram/status');
      const status = await statusResponse.json();
      setMetaRedirectUri(status.redirectUri || '');
      if (!status.configured) { setMetaSetupOpen(true); setAccountMenuOpen(false); return; }
    } catch { setAccountMessage('Start Postflow with start-postflow.ps1 first.'); return; }
    const popup = window.open('http://127.0.0.1:3030/instagram/connect', 'instagram-connect', 'popup=yes,width=620,height=760');
    if (!popup) { setAccountMessage('Allow pop-ups for Postflow, then try again.'); return; }
    setAccountMessage('Sign in securely in the Meta window. Postflow never sees your password.');
    const receiveConnection = (event: MessageEvent) => {
      if (event.origin === 'http://127.0.0.1:3030' && event.data?.type === 'postflow-instagram-connected') {
        window.removeEventListener('message', receiveConnection);
        refreshInstagramStatus();
        setAccountMenuOpen(false);
      }
    };
    window.addEventListener('message', receiveConnection);
    const popupWatcher = window.setInterval(() => {
      if (popup.closed) {
        window.clearInterval(popupWatcher);
        window.removeEventListener('message', receiveConnection);
        refreshInstagramStatus();
      }
    }, 800);
  }

  async function saveMetaSetup() {
    try {
      setAccountMessage('Saving Meta app settings locally…');
      const response = await fetch('http://127.0.0.1:3030/instagram/configure-app', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ appId: metaAppId, appSecret: metaAppSecret }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setMetaAppSecret('');
      setMetaSetupOpen(false);
      setAccountMessage('Meta app configured. Opening Instagram sign-in…');
      await connectInstagram();
    } catch (error) {
      setAccountMessage(error instanceof Error ? error.message : 'Could not save the Meta app settings.');
    }
  }

  async function selectInstagramAccount(account: InstagramAccount) {
    const response = await fetch('http://127.0.0.1:3030/instagram/select', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ accountId: account.id }) });
    if (!response.ok) { setAccountMessage('Could not select that account.'); return; }
    setInstagramUsername(account.username);
    setAccountStatus('ready');
    setAccountMessage('Professional account selected.');
    setAccountMenuOpen(false);
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between px-5 lg:px-8">
          <div className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm"><Sparkles className="size-4" /></div><div><p className="font-semibold leading-none tracking-tight">Postflow</p><p className="mt-1 text-[11px] text-muted-foreground">Instagram scheduler</p></div></div>
          <div className="flex items-center gap-2"><div className="relative hidden sm:block"><button onClick={() => { setAccountMenuOpen((open) => !open); refreshInstagramStatus(); }} aria-expanded={accountMenuOpen} className="flex items-center gap-2 rounded-full border bg-card px-3 py-2 text-xs font-medium"><span className={`size-2 rounded-full ${accountStatus === 'ready' ? 'bg-emerald-500' : 'bg-amber-400'}`} />{accountStatus === 'ready' ? `@${instagramUsername}` : 'Instagram not connected'} <ChevronDown className={`size-3 transition ${accountMenuOpen ? 'rotate-180' : ''}`} /></button>{accountMenuOpen && <div className="absolute right-0 top-11 z-50 w-72 rounded-2xl border bg-card p-2 shadow-xl"><p className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Instagram accounts</p>{instagramAccounts.map((account) => <button key={account.id} onClick={() => selectInstagramAccount(account)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-secondary"><span className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-[#7952e8] to-[#ef785b] text-[10px] font-bold text-white">{account.username.slice(0,2).toUpperCase()}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">@{account.username}</span><span className="block text-[11px] text-muted-foreground">Professional account</span></span>{instagramUsername === account.username && <Check className="size-4 text-emerald-500" />}</button>)}{instagramAccounts.length > 0 && <div className="my-1 border-t" />}<button onClick={connectInstagram} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-[#6942d0] hover:bg-[#f4f1ff]"><Plus className="size-4" /> Add another account</button><p className="px-3 pb-1 pt-2 text-[10px] leading-relaxed text-muted-foreground">Sign-in happens securely on Meta. Postflow never receives your password.</p></div>}</div><Button variant="ghost" size="icon" aria-label="Help"><CircleHelp /></Button><Button variant="ghost" size="icon" aria-label="Settings"><Settings /></Button></div>
        </div>
      </header>
      <div className="mx-auto max-w-[1500px] px-5 py-7 lg:px-8">
        <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="mb-2 text-xs font-semibold uppercase tracking-[.18em] text-primary">New schedule</p><h1 className="text-3xl font-semibold tracking-[-.04em] sm:text-4xl">Shape your posting rhythm.</h1><p className="mt-2 max-w-xl text-sm text-muted-foreground">Arrange your media, set the pace, then let your queue roll.</p></div><div className="flex gap-2"><Button variant="outline" className="h-10 px-4">Save draft</Button><Button className="h-10 bg-[#7952e8] px-4 hover:bg-[#6843d5]" onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2400); }}>{saved ? <><Check /> Schedule ready</> : <><Send /> Activate schedule</>}</Button></div></div>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(330px,.65fr)]">
          <section className="rounded-3xl border bg-card p-4 shadow-[0_18px_45px_rgb(45_35_80/5%)] sm:p-6">
            <div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-semibold tracking-tight">Media queue</h2><p className="mt-1 text-sm text-muted-foreground">Drag cards or use the arrows to choose what posts first.</p></div><span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">{media.length} items</span></div>
            <input ref={fileInput} className="hidden" type="file" multiple accept="image/jpeg,video/*" onChange={(event) => addFiles(event.target.files)} />
            <button onClick={() => fileInput.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); addFiles(event.dataTransfer.files); }} className="mb-5 flex w-full items-center justify-center gap-3 rounded-2xl border border-dashed border-[#bdb2e7] bg-[#f8f6ff] px-4 py-4 text-sm font-medium text-[#6942d0] transition hover:border-[#7952e8] hover:bg-[#f2efff]"><span className="grid size-9 place-items-center rounded-xl bg-white shadow-sm"><ImagePlus className="size-4" /></span>Add photos or videos <span className="hidden font-normal text-muted-foreground sm:inline">· JPEG, MP4 or MOV</span></button>
            <div className="mb-4 flex min-h-9 flex-wrap items-center justify-between gap-2 rounded-xl bg-secondary/55 px-3 py-2"><div className="flex items-center gap-2"><button onClick={() => setSelected(selected.size === media.length ? new Set() : new Set(media.map((item) => item.id)))} className="text-xs font-semibold text-[#6942d0]">{selected.size === media.length && media.length ? 'Clear all' : 'Select all'}</button><span className="text-xs text-muted-foreground">{selected.size ? `${selected.size} selected` : 'Select cards for group actions'}</span></div>{selected.size > 0 && <div className="flex gap-1"><Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Cancel</Button><Button variant="destructive" size="sm" onClick={() => removeItems(selected)}><Trash2 /> Remove from queue</Button></div>}</div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {media.map((item, index) => <article key={item.id} draggable onDragStart={() => setDraggedId(item.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => dropOn(item.id)} className={`group relative overflow-visible rounded-2xl border bg-background transition hover:-translate-y-0.5 hover:shadow-lg ${selected.has(item.id) ? 'ring-2 ring-[#7952e8] ring-offset-2' : ''}`}><div className="relative aspect-[4/5] overflow-hidden rounded-t-2xl bg-muted"><img src={item.src} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" /><div className="absolute inset-x-0 top-0 flex items-center justify-between p-2"><span className="grid size-7 place-items-center rounded-lg bg-black/55 text-xs font-bold text-white backdrop-blur">{index + 1}</span><div className="flex gap-1"><button onClick={() => toggleSelected(item.id)} className={`grid size-7 place-items-center rounded-lg border text-white backdrop-blur ${selected.has(item.id) ? 'border-[#a995ff] bg-[#7952e8]' : 'border-white/50 bg-black/45'}`} aria-label={`${selected.has(item.id) ? 'Deselect' : 'Select'} ${item.name}`}>{selected.has(item.id) ? <Check className="size-4" /> : <span className="size-3 rounded-sm border border-white" />}</button><button onClick={() => setMenuId(menuId === item.id ? null : item.id)} className="grid size-7 place-items-center rounded-lg bg-black/45 text-white backdrop-blur" aria-label={`More options for ${item.name}`}><MoreHorizontal className="size-4" /></button></div></div>{item.type === 'Video' && <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur"><Play className="size-3 fill-current" /> {item.duration ?? 'Video'}</span>}</div>{menuId === item.id && <div className="absolute right-2 top-10 z-20 w-40 rounded-xl border bg-popover p-1.5 text-xs shadow-xl"><button onClick={() => { setMedia((current) => [{ ...item, id: `${item.id}-copy-${Date.now()}`, name: `Copy of ${item.name}` }, ...current]); setMenuId(null); }} className="flex w-full items-center rounded-lg px-2.5 py-2 hover:bg-muted"><Plus className="mr-2 size-3" /> Duplicate</button><button onClick={() => removeItems(new Set([item.id]))} className="flex w-full items-center rounded-lg px-2.5 py-2 text-destructive hover:bg-destructive/10"><Trash2 className="mr-2 size-3" /> Remove</button></div>}<div className="flex items-center gap-1 rounded-b-2xl p-2"><GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground" /><p className="min-w-0 flex-1 truncate text-xs font-medium">{item.name}</p><button onClick={() => move(item.id, -1)} disabled={index === 0} className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-20" aria-label="Move earlier"><ArrowUp className="size-3" /></button><button onClick={() => move(item.id, 1)} disabled={index === media.length - 1} className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-20" aria-label="Move later"><ArrowDown className="size-3" /></button></div></article>)}
            </div>
          </section>
          <aside className="space-y-5">
            <section className="rounded-3xl border bg-card p-5 shadow-[0_18px_45px_rgb(45_35_80/5%)]">
              <div className="mb-4 flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#eee9ff] text-[#6942d0]"><Camera className="size-4" /></span><div><h2 className="font-semibold">Instagram account</h2><p className="text-xs text-muted-foreground">Choose where this queue will publish</p></div></div>
              {metaSetupOpen ? <div className="space-y-3 rounded-2xl border bg-background p-3"><div><p className="text-sm font-semibold">One-time Meta app setup</p><p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">These developer credentials stay on this computer. Your Instagram password will be entered only in Meta’s popup.</p></div><div><label className="mb-1 block text-[11px] font-semibold">Instagram app ID</label><Input value={metaAppId} onChange={(event) => setMetaAppId(event.target.value)} inputMode="numeric" placeholder="Numeric app ID from Meta" /></div><div><label className="mb-1 block text-[11px] font-semibold">Instagram app secret</label><Input value={metaAppSecret} onChange={(event) => setMetaAppSecret(event.target.value)} type="password" placeholder="Stored locally" /></div><div><label className="mb-1 block text-[11px] font-semibold">OAuth redirect URL</label><div className="flex gap-2"><Input value={metaRedirectUri} readOnly className="text-[11px]" /><Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(metaRedirectUri)}>Copy</Button></div><p className="mt-1 text-[10px] text-muted-foreground">Save this exact URL in Meta’s Instagram business login settings first.</p></div><div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={() => setMetaSetupOpen(false)}>Cancel</Button><Button className="flex-1 bg-[#7952e8] hover:bg-[#6843d5]" onClick={saveMetaSetup}>Save & sign in</Button></div><p className="text-[11px] text-muted-foreground">{accountMessage}</p></div> : accountStatus === 'ready' ? <div><div className="flex items-center justify-between rounded-2xl border bg-background p-3"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-[#7952e8] to-[#ef785b] text-xs font-bold text-white">{instagramUsername.slice(0, 2).toUpperCase()}</span><div><p className="text-sm font-semibold">@{instagramUsername}</p><p className="text-[11px] text-emerald-600">Professional account · selected</p></div></div><Check className="size-4 text-emerald-500" /></div><Button variant="outline" onClick={connectInstagram} className="mt-2 h-9 w-full"><Plus /> Add another account</Button></div> : <div><Button onClick={connectInstagram} className="h-10 w-full bg-[#7952e8] hover:bg-[#6843d5]"><Link2 /> Connect with Meta</Button><p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{accountMessage}</p></div>}
            </section>

            <section className="rounded-3xl border bg-card p-5 shadow-[0_18px_45px_rgb(45_35_80/5%)]">
              <div className="mb-4 flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#eaf7f1] text-[#25865e]"><FolderInput className="size-4" /></span><div><h2 className="font-semibold">Local folder automation</h2><p className="text-xs text-muted-foreground">Load files and archive successful posts</p></div></div>
              <div className="space-y-3"><label className="block text-xs font-semibold text-muted-foreground">Source folder<div className="relative mt-1.5"><Input value={mediaRoot} onChange={(event) => setMediaRoot(event.target.value)} className="h-9 bg-background pr-10 font-mono text-xs" /><button type="button" onClick={() => chooseFolder('source')} className="absolute right-1 top-1 grid size-7 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-[#6942d0]" aria-label="Choose source folder" title="Choose source folder"><FolderOpen className="size-4" /></button></div></label><label className="block text-xs font-semibold text-muted-foreground">DONE folder<div className="relative mt-1.5"><Input value={doneRoot} onChange={(event) => setDoneRoot(event.target.value)} className="h-9 bg-background pr-10 font-mono text-xs" /><button type="button" onClick={() => chooseFolder('done')} className="absolute right-1 top-1 grid size-7 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-[#6942d0]" aria-label="Choose DONE folder" title="Choose DONE folder"><FolderOpen className="size-4" /></button></div></label></div>
              <Button variant="outline" onClick={scanFolder} className="mt-4 h-9 w-full"><RefreshCw /> Connect & scan folder</Button>
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-secondary/65 p-3"><FolderCheck className="mt-0.5 size-4 shrink-0 text-[#25865e]" /><div><p className="text-xs font-semibold">{folderStatus}</p><p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">After a successful post: <span className="font-mono">YYYYMMDD_HHMM_account_001_name.jpg</span>. Failed posts stay in the source folder.</p></div></div>
            </section>

            <section className="rounded-3xl border bg-card p-5 shadow-[0_18px_45px_rgb(45_35_80/5%)]"><div className="mb-5 flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#fff0ea] text-[#e36a43]"><CalendarDays className="size-4" /></span><div><h2 className="font-semibold">Posting schedule</h2><p className="text-xs text-muted-foreground">America / New York</p></div></div><label className="text-xs font-semibold text-muted-foreground">Post every</label><div className="mt-2 flex items-center gap-2"><Input type="number" min={1} max={30} value={frequency} onChange={(event) => setFrequency(Number(event.target.value))} className="h-10 w-20 bg-background text-center font-semibold" /><span className="text-sm font-medium">days</span></div><div className="my-5 h-px bg-border" /><div className="mb-2 flex items-center justify-between"><label className="text-xs font-semibold text-muted-foreground">Times on posting days</label><button onClick={() => setTimes((current) => [...current, '3:00 PM'])} className="flex items-center gap-1 text-xs font-semibold text-[#6942d0]"><Plus className="size-3" /> Add time</button></div><div className="space-y-2">{times.map((time, index) => <div key={`${time}-${index}`} className="flex items-center gap-2"><Clock3 className="size-4 text-muted-foreground" /><Input value={time} onChange={(event) => setTimes((current) => current.map((value, i) => i === index ? event.target.value : value))} className="h-9 bg-background" /><Button variant="ghost" size="icon-sm" aria-label={`Remove ${time}`} onClick={() => setTimes((current) => current.filter((_, i) => i !== index))}><Trash2 /></Button></div>)}</div><p className="mt-4 rounded-xl bg-secondary/65 px-3 py-2 text-xs leading-relaxed text-muted-foreground"><strong className="text-foreground">{times.length} posts</strong> every {frequency} days · Next run Tuesday</p></section>
            <section className="rounded-3xl border bg-card p-5 shadow-[0_18px_45px_rgb(45_35_80/5%)]"><div className="mb-3 flex items-center justify-between"><label className="text-sm font-semibold">Caption for every post</label><span className="text-[11px] text-muted-foreground">{caption.length}/2,200</span></div><Textarea value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={2200} className="min-h-32 resize-none bg-background leading-relaxed" /><button className="mt-3 flex items-center gap-2 text-xs font-semibold text-[#6942d0]"><Sparkles className="size-3" /> Polish caption</button></section>
          </aside>
        </div>
        <section className="mt-6 rounded-3xl border bg-[#201d2c] p-5 text-white sm:p-6"><div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="font-semibold">Coming up</h2><p className="mt-1 text-xs text-white/55">A preview of your next four posts</p></div><div className="flex items-center gap-2 text-xs text-white/65"><Camera className="size-4" /> Publishing to <strong className="text-white">@yourstudio</strong></div></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{scheduled.map(({ item, day, time }, index) => <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-white/[.08] p-3"><img src={item.src} alt="" className="size-14 rounded-xl object-cover" /><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wider text-[#bca9ff]">Post {index + 1}</p><p className="mt-1 truncate text-sm font-medium">{item.name}</p><p className="mt-1 text-[11px] text-white/55">{day} · {time}</p></div></div>)}</div></section>
      </div>
    </main>
  );
}

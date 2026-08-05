"use client";

import { useEffect, useMemo, useState } from "react";
import MediaLibrary from "./media-library";

type View = "command" | "brand" | "studio" | "media" | "pipeline" | "calendar" | "analytics" | "audit";
type ContentStatus = "inbox" | "develop" | "production" | "review" | "published";
type ContentItem = {
  id: number;
  title: string;
  pillar: string;
  format: string;
  channel: string;
  status: ContentStatus;
  nextAction: string;
  priority: number;
  createdAt?: string;
};

const navItems: { id: View; label: string; icon: string }[] = [
  { id: "command", label: "Command", icon: "⌁" },
  { id: "brand", label: "Brand", icon: "◇" },
  { id: "studio", label: "Round studio", icon: "◉" },
  { id: "media", label: "Source videos", icon: "↑" },
  { id: "pipeline", label: "Content pipeline", icon: "▤" },
  { id: "calendar", label: "Calendar", icon: "□" },
  { id: "analytics", label: "Analytics", icon: "↗" },
  { id: "audit", label: "Account audit", icon: "◎" },
];

const launchGates = [
  { label: "Arccos use-rights path", detail: "Required before monetized publishing", status: "blocked" },
  { label: "Reference swing pack", detail: "Face-on, down-the-line, driver, iron, putt", status: "next" },
  { label: "Pilot round selected", detail: "Use one corrected 9-hole Arccos round first", status: "open" },
  { label: "Course model source", detail: "License terrain, aerial and branding inputs", status: "open" },
];

const productionStages = [
  { n: "01", title: "Round data", copy: "Verify every shot, lie, club and penalty in Arccos.", state: "ready" },
  { n: "02", title: "Story cut", copy: "Choose six to eight decisions that explain the round.", state: "next" },
  { n: "03", title: "Course twin", copy: "Build the photoreal terrain and broadcast camera paths.", state: "queued" },
  { n: "04", title: "Player twin", copy: "Map your approved reference swings to each shot type.", state: "queued" },
  { n: "05", title: "Broadcast edit", copy: "Add tracer, yardages, score bug, VO and sound design.", state: "queued" },
  { n: "06", title: "Publish set", copy: "Master 9:16, 16:9 and carousel versions with disclosure.", state: "queued" },
];

const series = [
  { tag: "FLAGSHIP", title: "Played, Not Filmed", copy: "Your real Arccos round rebuilt as an AI-assisted major-championship broadcast.", cadence: "1× / month", accent: "coral" },
  { tag: "PROFESSIONAL", title: "Inside Tournament Golf", copy: "Useful, privacy-safe lessons from preparing and operating golf events.", cadence: "2× / month", accent: "gold" },
  { tag: "PLAYER", title: "Build the Better Round", copy: "Course strategy, equipment decisions, practice and honest performance review.", cadence: "1× / week", accent: "blue" },
];

const week = [
  { day: "MON", date: "10", item: "Round breakdown", type: "Carousel", tone: "coral" },
  { day: "TUE", date: "11", item: "Capture / build", type: "No post", tone: "quiet" },
  { day: "WED", date: "12", item: "Tournament lesson", type: "Reel", tone: "gold" },
  { day: "THU", date: "13", item: "Story: the build", type: "Stories", tone: "blue" },
  { day: "FRI", date: "14", item: "Shot decision", type: "Short", tone: "coral" },
  { day: "SAT", date: "15", item: "Golf life", type: "Photo", tone: "green" },
  { day: "SUN", date: "16", item: "Review + reset", type: "30 min", tone: "quiet" },
];

const initialContent: ContentItem[] = [
  { id: -1, title: "What a +0.5 sees from 150", pillar: "player", format: "Carousel", channel: "Instagram", status: "inbox", nextAction: "Write the hook", priority: 2 },
  { id: -2, title: "Why starting-hole design matters", pillar: "professional", format: "Reel", channel: "Instagram", status: "inbox", nextAction: "Set the privacy-safe angle", priority: 3 },
  { id: -3, title: "The shot Arccos got wrong", pillar: "technology", format: "Short", channel: "Instagram", status: "inbox", nextAction: "Capture the corrected shot", priority: 1 },
  { id: -4, title: "Played, Not Filmed · trailer", pillar: "flagship", format: "Trailer", channel: "Instagram", status: "develop", nextAction: "Complete the creative brief", priority: 1 },
  { id: -5, title: "Build the digital twin", pillar: "technology", format: "Build log", channel: "Instagram", status: "develop", nextAction: "Choose the reference angles", priority: 2 },
  { id: -6, title: "One tournament lesson", pillar: "professional", format: "Reel", channel: "Instagram", status: "develop", nextAction: "Write the 20-second script", priority: 3 },
  { id: -7, title: "Partender origin story", pillar: "brand", format: "Reel", channel: "Instagram", status: "production", nextAction: "Assemble the first cut", priority: 2 },
];

const pipelineColumns: { id: ContentStatus; title: string }[] = [
  { id: "inbox", title: "INBOX" },
  { id: "develop", title: "DEVELOP" },
  { id: "production", title: "PRODUCTION" },
  { id: "review", title: "REVIEW" },
  { id: "published", title: "PUBLISHED" },
];

function StatusDot({ status }: { status: string }) {
  return <span className={`status-dot ${status}`} aria-label={status} />;
}

function SectionHeading({ eyebrow, title, copy }: { eyebrow: string; title: string; copy?: string }) {
  return (
    <header className="section-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {copy ? <p className="section-copy">{copy}</p> : null}
    </header>
  );
}

export default function Home() {
  const [active, setActive] = useState<View>("command");
  const [captureOpen, setCaptureOpen] = useState(false);
  const [idea, setIdea] = useState("");
  const [contentItems, setContentItems] = useState<ContentItem[]>(initialContent);
  const [storageMode, setStorageMode] = useState<"loading" | "persistent" | "demo">("loading");

  const activeLabel = useMemo(() => navItems.find((item) => item.id === active)?.label ?? "Command", [active]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/content")
      .then(async (response) => {
        if (!response.ok) throw new Error("Content storage unavailable");
        return response.json() as Promise<{ items: ContentItem[] }>;
      })
      .then((payload) => {
        if (cancelled) return;
        setContentItems(payload.items);
        setStorageMode("persistent");
      })
      .catch(() => {
        if (!cancelled) setStorageMode("demo");
      });
    return () => { cancelled = true; };
  }, []);

  async function saveIdea() {
    const clean = idea.trim();
    if (!clean) return;
    const optimistic: ContentItem = { id: -Date.now(), title: clean, pillar: "player", format: "Short-form", channel: "Instagram", status: "inbox", nextAction: "Write the hook", priority: 3 };
    setContentItems((current) => [optimistic, ...current]);
    setIdea("");
    setCaptureOpen(false);
    try {
      const response = await fetch("/api/content", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: clean }) });
      if (!response.ok) throw new Error("Unable to save");
      const payload = await response.json() as { item: ContentItem };
      setContentItems((current) => current.map((item) => item.id === optimistic.id ? payload.item : item));
      setStorageMode("persistent");
    } catch {
      setStorageMode("demo");
    }
  }

  async function advanceItem(item: ContentItem) {
    const sequence: ContentStatus[] = ["inbox", "develop", "production", "review", "published"];
    const next = sequence[Math.min(sequence.indexOf(item.status) + 1, sequence.length - 1)];
    if (next === item.status) return;
    setContentItems((current) => current.map((row) => row.id === item.id ? { ...row, status: next } : row));
    if (item.id < 0) return;
    try {
      const response = await fetch("/api/content", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: item.id, status: next }) });
      if (!response.ok) throw new Error("Unable to update");
    } catch {
      setContentItems((current) => current.map((row) => row.id === item.id ? item : row));
      setStorageMode("demo");
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <span className="brand-mark">P</span>
          <div><strong>PARTENDER</strong><span>Social command</span></div>
        </div>

        <nav aria-label="Primary">
          <p className="nav-label">Workspace</p>
          {navItems.map((item) => (
            <button key={item.id} className={active === item.id ? "nav-item active" : "nav-item"} onClick={() => setActive(item.id)}>
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>{item.label}
              {item.id === "studio" ? <span className="nav-badge">01</span> : null}
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />
        <div className="season-card">
          <p className="eyebrow">Launch season</p>
          <strong>August · September</strong>
          <div className="progress-track"><span style={{ width: "18%" }} /></div>
          <small>2 of 11 launch gates ready</small>
        </div>
        <div className="account-chip"><span className="avatar">M</span><div><strong>@subpartending</strong><small>{storageMode === "persistent" ? "Workspace saved" : storageMode === "loading" ? "Loading workspace…" : "Demo mode · retry later"}</small></div><span>•••</span></div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-mark">P</span><strong>PARTENDER</strong></div>
          <div className="crumb"><span>PARTENDER</span><b>/</b>{activeLabel}</div>
          <div className="top-actions"><button className="icon-button" aria-label="Search">⌕</button><button className="capture-button" onClick={() => setCaptureOpen(true)}>＋ Capture idea</button></div>
        </header>

        <div className="content-wrap">
          {active === "command" ? (
            <>
              <section className="welcome-row">
                <div><p className="eyebrow">Partender · launch command</p><h1>Turn every round into a broadcast.</h1><p className="lede">A golf brand built at the intersection of player, tournament professional and technology builder.</p></div>
                <div className="north-star"><span>90-day north star</span><strong>12</strong><p>high-quality posts · 1 flagship pilot · 3 repeatable series</p></div>
              </section>

              <section className="hero-grid">
                <article className="broadcast-hero">
                  <div className="hero-image" />
                  <div className="hero-shade" />
                  <div className="live-pill"><span /> FLAGSHIP PILOT</div>
                  <div className="hero-content"><p className="eyebrow">Episode 001 · proof of concept</p><h2>Play the round<br />without filming the round.</h2><p>Real shot history. Photoreal course twin. Your reference swing. Major-style broadcast storytelling.</p><button onClick={() => setActive("studio")}>Open round studio <span>→</span></button></div>
                  <div className="score-bug"><div><small>PILOT</small><strong>01</strong></div><div><small>FORMAT</small><strong>9 holes</strong></div><div><small>STATUS</small><strong>Pre-production</strong></div></div>
                </article>

                <aside className="next-action-card">
                  <div className="card-topline"><p className="eyebrow">Next best action</p><span>01</span></div>
                  <h3>Build your digital-twin reference pack.</h3>
                  <p>Capture clean, repeatable swing references before selecting an AI video vendor. This is the quality ceiling for every future episode.</p>
                  <ul><li>Driver · face-on + down-the-line</li><li>Iron · face-on + down-the-line</li><li>Short game · bunker · putt</li><li>Neutral walk, setup and celebration</li></ul>
                  <button onClick={() => setActive("media")}>Upload reference videos</button>
                </aside>
              </section>

              <section className="metric-strip">
                <div><span>Brand position</span><strong>Player × Operator × Builder</strong><small>Distinctive and defensible</small></div>
                <div><span>Public identity</span><strong>Partender</strong><small>@subpartending under review</small></div>
                <div><span>Primary audience</span><strong>Serious golf people</strong><small>Players · pros · partners</small></div>
                <div><span>Publishing rule</span><strong>Manual approval</strong><small>No automatic posting</small></div>
              </section>

              <section className="two-column">
                <article className="panel launch-panel"><div className="panel-title"><div><p className="eyebrow">Critical path</p><h3>Launch gates</h3></div><button onClick={() => setActive("studio")}>View all →</button></div>
                  <div className="gate-list">{launchGates.map((gate) => <div className="gate-row" key={gate.label}><StatusDot status={gate.status} /><div><strong>{gate.label}</strong><small>{gate.detail}</small></div><span>›</span></div>)}</div>
                </article>
                <article className="panel mix-panel"><div className="panel-title"><div><p className="eyebrow">Sustainable output</p><h3>Monthly content mix</h3></div><span className="subtle-pill">12 posts</span></div>
                  <div className="mix-chart"><div className="donut"><div><strong>12</strong><span>posts</span></div></div><div className="legend"><p><i className="coral" />Player & strategy <b>5</b></p><p><i className="gold" />Golf professional <b>3</b></p><p><i className="blue" />Technology & build <b>3</b></p><p><i className="green" />Golf life <b>1</b></p></div></div>
                </article>
              </section>

              <section className="panel inbox-panel"><div className="panel-title"><div><p className="eyebrow">Idea inbox</p><h3>Worth developing next</h3></div><span className="subtle-pill">{contentItems.filter((item) => item.status === "inbox").length}</span></div>{contentItems.filter((item) => item.status === "inbox").slice(0,3).map((item) => <div className="inbox-row" key={item.id}><span>{item.pillar.toUpperCase()}</span><strong>{item.title}</strong><button onClick={() => setActive("pipeline")}>Develop →</button></div>)}</section>
            </>
          ) : null}

          {active === "brand" ? (
            <section className="page-section">
              <SectionHeading eyebrow="Brand system" title="Partender is the golfer behind the golf." copy="The strongest position is not influencer, teaching pro or equipment reviewer. It is a credible player and working golf professional who uses technology to reveal what usually stays invisible." />
              <div className="position-statement"><p>POSITIONING STATEMENT</p><h3>A competitive golfer and tournament professional showing how better play, better operations and better technology come together inside modern golf.</h3></div>
              <div className="three-cards">
                <article className="pillar-card"><span>01</span><p>THE PLAYER</p><h3>Earn attention</h3><p>Scratch-level decisions, honest rounds, practice, equipment and competition.</p><small>Proof: real score · real shot data · real choices</small></article>
                <article className="pillar-card"><span>02</span><p>THE OPERATOR</p><h3>Build authority</h3><p>A privacy-safe look at tournament preparation, service and execution.</p><small>Proof: useful systems · hard-earned judgment</small></article>
                <article className="pillar-card"><span>03</span><p>THE BUILDER</p><h3>Create distinction</h3><p>Arccos, Rapsodo, course models, dashboards and golf-data experiments.</p><small>Proof: working prototypes · clear outcomes</small></article>
              </div>
              <div className="series-grid">{series.map((item) => <article className="series-card" key={item.title}><i className={item.accent} /><div><span>{item.tag}</span><h3>{item.title}</h3><p>{item.copy}</p></div><strong>{item.cadence}</strong></article>)}</div>
              <div className="brand-grid"><article className="panel"><p className="eyebrow">Voice</p><h3>Smart without performing intelligence.</h3><div className="do-dont"><div><strong>Sound like</strong><p>Curious · exact · competitive · self-aware · useful</p></div><div><strong>Avoid</strong><p>Fake certainty · generic motivation · manufactured controversy · employer claims</p></div></div></article><article className="panel"><p className="eyebrow">Audience promise</p><h3>Every post earns its place.</h3><ul className="clean-list"><li><b>Teach</b> a decision someone can use.</li><li><b>Reveal</b> a part of golf they rarely see.</li><li><b>Document</b> an authentic moment worth remembering.</li></ul></article></div>
            </section>
          ) : null}

          {active === "studio" ? (
            <section className="page-section">
              <SectionHeading eyebrow="Flagship format · Episode 001" title="Played, Not Filmed" copy="A real round reconstructed from verified shot data and clearly disclosed AI-assisted visuals. Build a nine-hole proof first; scale only after the result looks believable and the data-use path is cleared." />
              <div className="studio-layout">
                <div className="stage-list">{productionStages.map((stage, index) => <article className={`stage-card ${stage.state}`} key={stage.n}><div className="stage-number">{stage.n}</div><div><p>{stage.title}</p><h3>{stage.copy}</h3></div><div className="stage-state"><StatusDot status={stage.state} />{stage.state}</div>{index < productionStages.length - 1 ? <span className="stage-line" /> : null}</article>)}</div>
                <aside className="studio-brief"><p className="eyebrow">Production brief</p><h3>The viewer should feel like they followed you for nine holes—not watched a tech demo.</h3><div className="brief-row"><span>Run time</span><strong>4–6 min master</strong></div><div className="brief-row"><span>Short cut</span><strong>45–75 sec</strong></div><div className="brief-row"><span>Shots shown</span><strong>6–8 decisions</strong></div><div className="brief-row"><span>Disclosure</span><strong>AI-assisted recreation</strong></div><div className="rights-warning"><strong>Rights gate</strong><p>Standard Arccos terms authorize personal, non-commercial sharing of selected screenshots. Partnership or monetized use should use the licensed API or written permission.</p><a href="https://www.arccosgolf.com/blogs/community/clippd-to-become-first-platform-to-seamlessly-integrate-arccos-on-course-data" target="_blank" rel="noreferrer">Official API overview ↗</a></div></aside>
              </div>
              <div className="panel spec-panel"><div><p className="eyebrow">Reference capture · v1</p><h3>Digital-twin source pack</h3><button className="inline-action" onClick={() => setActive("media")}>Open source-video library →</button></div><div className="spec-grid"><p><span>8</span><b>Swing clips</b><small>Locked camera · 4K/60 · full body</small></p><p><span>3</span><b>Movement clips</b><small>Walk · setup · reaction</small></p><p><span>12+</span><b>Appearance photos</b><small>Neutral light · all angles</small></p><p><span>1</span><b>Wardrobe lock</b><small>Full outfit · shoes · glove · hat</small></p></div></div>
            </section>
          ) : null}

          {active === "media" ? <MediaLibrary /> : null}

          {active === "pipeline" ? (
            <section className="page-section">
              <SectionHeading eyebrow="Content operating system" title="One idea, one owner, one next action." copy="The pipeline protects quality and keeps content from living as scattered notes. Publishing remains a deliberate manual approval." />
              <div className="pipeline-status"><span className={`storage-light ${storageMode}`} />{storageMode === "persistent" ? "Changes save across sessions" : storageMode === "loading" ? "Opening workspace…" : "Showing demo data; changes may not persist"}</div>
              <div className="kanban">
                {pipelineColumns.map((column) => {
                  const items = contentItems.filter((item) => item.status === column.id).sort((a,b) => a.priority - b.priority);
                  return <div className="kanban-col" key={column.id}><div className="kanban-head"><span>{column.title}</span><b>{items.length}</b></div>{items.map((item) => <article className="content-card" key={item.id}><span>{item.pillar.toUpperCase()}</span><h3>{item.title}</h3><p>{item.channel} · {item.format}</p><small>Next: {item.nextAction}</small>{column.id !== "published" ? <button className="advance-card" onClick={() => advanceItem(item)}>Move forward →</button> : <b className="published-mark">Published ✓</b>}</article>)}{column.id === "inbox" ? <button className="add-card" onClick={() => setCaptureOpen(true)}>＋ Add idea</button> : null}</div>;
                })}
              </div>
            </section>
          ) : null}

          {active === "calendar" ? (
            <section className="page-section">
              <SectionHeading eyebrow="Publishing rhythm" title="A week that leaves room to play golf." copy="Three feed posts per week is enough for launch. Capture naturally, batch the build work, and publish only finished ideas." />
              <div className="week-grid">{week.map((day) => <article className="day-card" key={day.day}><div><span>{day.day}</span><strong>{day.date}</strong></div><i className={day.tone} /><h3>{day.item}</h3><p>{day.type}</p><button>Open slot</button></article>)}</div>
              <div className="three-cards compact"><article className="panel"><p className="eyebrow">Monday</p><h3>Teach a golf decision</h3><p>Carousel or voiceover using one real moment from the latest round.</p></article><article className="panel"><p className="eyebrow">Wednesday</p><h3>Reveal the golf industry</h3><p>One useful, employer-safe lesson from tournament operations.</p></article><article className="panel"><p className="eyebrow">Friday</p><h3>Show the build</h3><p>Technology, prototype, shot visualization or flagship progress.</p></article></div>
            </section>
          ) : null}

          {active === "analytics" ? (
            <section className="page-section">
              <SectionHeading eyebrow="Learning system" title="Track proof, not vanity." copy="The first 90 days are about identifying repeatable formats. Follower count matters less than saves, qualified conversations and completion." />
              <div className="metric-strip analytics-strip"><div><span>Primary metric</span><strong>Qualified engagement</strong><small>Saves + shares + useful replies</small></div><div><span>Flagship metric</span><strong>Completion rate</strong><small>Does the story hold attention?</small></div><div><span>Career metric</span><strong>Industry conversations</strong><small>DMs · intros · opportunities</small></div><div><span>Production metric</span><strong>Hours per post</strong><small>Quality must become repeatable</small></div></div>
              <div className="panel chart-panel"><div className="panel-title"><div><p className="eyebrow">Launch baseline</p><h3>Performance will populate after publishing</h3></div><span className="subtle-pill">No data yet</span></div><div className="empty-chart"><div className="chart-lines"><span /><span /><span /><span /></div><div className="empty-message"><span>↗</span><strong>Start with clean evidence</strong><p>Record 24-hour and 7-day results for every post. Compare series after at least three posts each.</p></div></div></div>
            </section>
          ) : null}

          {active === "audit" ? (
            <section className="page-section">
              <SectionHeading eyebrow="Existing account" title="@subpartending" copy="The handle is confirmed. A reliable visual, content and performance audit still needs either account access through a connected workflow or screenshots plus an Instagram Insights export." />
              <div className="audit-grid"><article className="panel audit-summary"><p className="eyebrow">Current evidence</p><div className="audit-row"><span>Account</span><strong>Instagram · @subpartending</strong><i className="check">Confirmed</i></div><div className="audit-row"><span>Public brand</span><strong>Partender</strong><i className="check">Decided</i></div><div className="audit-row"><span>Content inventory</span><strong>Not yet observable</strong><i>Needs input</i></div><div className="audit-row"><span>Insights baseline</span><strong>Not supplied</strong><i>Needs export</i></div></article><article className="panel"><p className="eyebrow">Audit packet</p><h3>Bring these once—then the dashboard can make decisions.</h3><ul className="clean-list numbered"><li><b>Profile screenshot</b><span>Bio, image, links and highlights.</span></li><li><b>Last 12 posts</b><span>Grid plus post-level insights.</span></li><li><b>90-day overview</b><span>Reach, follows, engagement and audience.</span></li><li><b>Top five posts</b><span>Views, watch time, saves and shares.</span></li></ul><button className="wide-button">Mark audit packet ready</button></article></div>
              <div className="panel recommendation"><span>RECOMMENDATION</span><div><h3>Do not delete the old identity before the new one earns recognition.</h3><p>Keep @subpartending through the pilot, update the display name and bio to Partender, then evaluate a handle migration after checking availability and preserving account continuity.</p></div></div>
            </section>
          ) : null}
        </div>

        <nav className="mobile-nav" aria-label="Mobile primary">{navItems.slice(0, 5).map((item) => <button key={item.id} className={active === item.id ? "active" : ""} onClick={() => setActive(item.id)}><span>{item.icon}</span>{item.label.split(" ")[0]}</button>)}</nav>
      </main>

      {captureOpen ? <div className="modal-backdrop" onMouseDown={() => setCaptureOpen(false)}><div className="capture-modal" role="dialog" aria-modal="true" aria-labelledby="capture-title" onMouseDown={(event) => event.stopPropagation()}><div className="modal-head"><div><p className="eyebrow">Quick capture</p><h2 id="capture-title">What is worth making?</h2></div><button onClick={() => setCaptureOpen(false)} aria-label="Close">×</button></div><textarea autoFocus value={idea} onChange={(event) => setIdea(event.target.value)} placeholder="One clear idea, question or moment…" /><div className="modal-prompts"><button onClick={() => setIdea("A decision from my latest round that most golfers would miss")}>Round decision</button><button onClick={() => setIdea("A behind-the-scenes tournament lesson I can share safely")}>Golf work</button><button onClick={() => setIdea("Show how the Played, Not Filmed episode is being built")}>Build log</button></div><div className="modal-footer"><small>Saved to the idea inbox</small><button onClick={saveIdea} disabled={!idea.trim()}>Save idea →</button></div></div></div> : null}
    </div>
  );
}

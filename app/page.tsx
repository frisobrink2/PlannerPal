"use client";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronRight,
  Clock3,
  Inbox,
  ListTodo,
  Mail as MailIcon,
  RotateCcw,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import {
  Draft,
  fixed,
  initialState,
  Mail,
  mails,
  Priority,
  State,
  Task,
  time,
} from "./data";
const key = "plannerpal-demo-v1";
const tabs = ["Inbox", "Taken", "Dagplanning", "Antwoordconcepten"] as const;
type Tab = (typeof tabs)[number];
function validState(value: unknown): value is State {
  if (!value || typeof value !== "object") return false;
  const s = value as State;
  return (
    Array.isArray(s.tasks) &&
    s.tasks.every(
      (t) =>
        t &&
        Number.isFinite(t.id) &&
        mails.some((m) => m.id === t.mailId) &&
        typeof t.title === "string" &&
        Number.isFinite(t.duration) &&
        t.duration >= 5 &&
        t.duration <= 480 &&
        ["Hoog", "Normaal", "Laag"].includes(t.priority) &&
        typeof t.deadline === "string" &&
        typeof t.done === "boolean" &&
        (t.start === undefined || Number.isFinite(t.start)),
    ) &&
    Array.isArray(s.drafts) &&
    s.drafts.every(
      (d) =>
        d &&
        mails.some((m) => m.id === d.mailId) &&
        typeof d.text === "string" &&
        typeof d.approved === "boolean",
    ) &&
    Array.isArray(s.read) &&
    s.read.every(Number.isFinite)
  );
}
export default function Home() {
  const [state, setState] = useState<State>(initialState);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [tab, setTab] = useState<Tab>("Inbox");
  const [selected, setSelected] = useState<Mail | null>(null);
  const [proposal, setProposal] = useState<Task | null>(null);
  const [planning, setPlanning] = useState<Task | null>(null);
  const [slot, setSlot] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("Alle mails");
  const [query, setQuery] = useState("");
  const [reset, setReset] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (validState(parsed)) setState(parsed);
        else
          setNotice(
            "Opgeslagen data kon niet worden gelezen. De voorbeelddata is geladen.",
          );
      }
    } catch {
      setStorageError(true);
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem(key, JSON.stringify(state));
        setStorageError(false);
      } catch {
        setStorageError(true);
      }
  }, [state, ready]);
  const modalOpen = Boolean(selected || planning || reset);
  useEffect(() => {
    if (!modalOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>(
      '[role="dialog"], [role="alertdialog"]',
    );
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelected(null);
        setPlanning(null);
        setReset(false);
      }
      if (event.key === "Tab" && dialog) {
        const nodes = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input, select, textarea, [tabindex="0"]',
          ),
        );
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [modalOpen]);
  const update = (patch: Partial<State>) =>
    setState((s) => ({ ...s, ...patch }));
  const openMail = (m: Mail) => {
    setSelected(m);
    setProposal(null);
    setState((s) => ({ ...s, read: [...new Set([...s.read, m.id])] }));
  };
  const active = state.tasks.filter((t) => !t.done);
  const occupied = [
    ...fixed,
    ...active
      .filter((t) => t.start !== undefined)
      .map((t) => ({
        start: t.start!,
        duration: t.duration,
        title: t.title,
        type: "Taak",
      })),
  ];
  const freeSlots = (t: Task) =>
    Array.from({ length: 32 }, (_, i) => 540 + i * 15).filter(
      (s) =>
        s + t.duration <= 1020 &&
        !occupied.some(
          (b) => s < b.start + b.duration && s + t.duration > b.start,
        ),
    );
  const scheduled = active.filter((t) => t.start !== undefined);
  const plannedMinutes = scheduled.reduce((a, t) => a + t.duration, 0);
  const freeMinutes =
    480 - fixed.reduce((a, b) => a + b.duration, 0) - plannedMinutes;
  const accepted = (id: number) => state.tasks.some((t) => t.mailId === id);
  function accept() {
    if (
      !proposal ||
      !proposal.title.trim() ||
      !proposal.deadline ||
      proposal.duration < 5 ||
      proposal.duration > 480
    )
      return;
    setState((s) => ({
      ...s,
      tasks: [...s.tasks, { ...proposal, title: proposal.title.trim() }],
      drafts: s.drafts.some((d) => d.mailId === proposal.mailId)
        ? s.drafts
        : [
            ...s.drafts,
            { mailId: proposal.mailId, text: selected!.reply, approved: false },
          ],
    }));
    setProposal(null);
    setNotice("Taak toegevoegd. Je kunt hem nu inplannen.");
  }
  const shown = mails.filter(
    (m) =>
      (filter !== "Aandacht nodig" || !accepted(m.id)) &&
      (filter !== "Ongelezen" || !state.read.includes(m.id)) &&
      `${m.name} ${m.subject} ${m.body}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <div className="shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setTab("Inbox");
          }}
        >
          <span className="brand-icon">
            <CheckCheck size={24} />
          </span>
          plannerpal<span className="brand-dot">.</span>
        </a>
        <div className="workspace-label">PERSOONLIJKE WERKPLEK</div>
        <nav aria-label="Hoofdnavigatie">
          {tabs.map((t, i) => {
            const Icon = [Inbox, ListTodo, CalendarDays, Send][i];
            return (
              <button
                key={t}
                className={`nav-item ${tab === t ? "active" : ""}`}
                onClick={() => setTab(t)}
              >
                <Icon size={19} />
                <span>{t}</span>
                {i === 0 && (
                  <b>
                    {mails.filter((m) => !state.read.includes(m.id)).length}
                  </b>
                )}
                {i === 1 && <span className="nav-count">{active.length}</span>}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="calm-card">
            <span className="little-spark">
              <Sparkles size={19} />
            </span>
            <strong>Meer rust. Meer overzicht.</strong>
            <p>
              Jij bepaalt wat aandacht krijgt.
              <br />
              PlannerPal helpt je op weg.
            </p>
          </div>
          <button className="reset-button" onClick={() => setReset(true)}>
            <RotateCcw size={16} />
            Voorbeelddata herstellen
          </button>
          <div className="profile">
            <span className="avatar profile-avatar">JD</span>
            <div>
              <strong>Jouw werkplek</strong>
              <small>Zelfstandig professional</small>
            </div>
            <span className="demo-tag">DEMO</span>
          </div>
        </div>
      </aside>
      <main>
        <div className="topbar">
          <span>
            <span className="status-dot" /> Jouw persoonlijke overzicht
          </span>
          <span className="date">
            <CalendarDays size={15} /> Maandag 26 oktober 2026
          </span>
        </div>
        <div className="content">
          <div className="demo-banner">
            <Sparkles size={16} />
            <span>
              <strong>Even kennismaken.</strong> Dit is een demo met
              voorbeelddata. Er worden geen echte mails verstuurd.
            </span>
            <span className="demo-pill">DEMO</span>
          </div>
          <header className="page-header">
            <div>
              <div className="eyebrow">EEN NIEUWE WEEK, EEN HELDER BEGIN</div>
              <h1>
                {tab === "Inbox"
                  ? "Goedemorgen, aan de slag."
                  : tab === "Taken"
                    ? "Van aandacht naar actie."
                    : tab === "Dagplanning"
                      ? "Een dag die bij je past."
                      : "Een goed antwoord begint hier."}
              </h1>
              <p>
                {tab === "Inbox"
                  ? "Alles wat je aandacht vraagt, op één rustige plek."
                  : tab === "Taken"
                    ? "Kleine stappen, helder overzicht. Jij kiest wat eerst komt."
                    : tab === "Dagplanning"
                      ? "Geef je werk een plek. Houd ruimte voor jezelf."
                      : "Neem de tijd om je woorden te kiezen. Jij houdt de regie."}
              </p>
            </div>
            <div className="header-illustration" aria-hidden="true">
              <div className="illustration-paper">
                <span />
                <span />
                <span />
                <b>
                  <Check size={17} />
                </b>
              </div>
              <div className="illustration-circle" />
            </div>
          </header>
          <section className="stats" aria-label="Je overzicht">
            <button
              onClick={() => {
                setTab("Inbox");
                setFilter("Aandacht nodig");
              }}
            >
              <span className="stat-icon violet">
                <Inbox size={21} />
              </span>
              <div>
                <span>Mails om te bekijken</span>
                <strong>
                  {mails.filter((m) => !accepted(m.id)).length}
                  <small>vragen je aandacht</small>
                </strong>
              </div>
              <ArrowUpRight size={16} />
            </button>
            <button onClick={() => setTab("Taken")}>
              <span className="stat-icon amber">
                <ListTodo size={21} />
              </span>
              <div>
                <span>Openstaande taken</span>
                <strong>
                  {active.length}
                  <small>stap voor stap</small>
                </strong>
              </div>
              <ArrowUpRight size={16} />
            </button>
            <button onClick={() => setTab("Dagplanning")}>
              <span className="stat-icon green">
                <Clock3 size={21} />
              </span>
              <div>
                <span>Ruimte in je dag</span>
                <strong>
                  {Math.floor(freeMinutes / 60)}u{" "}
                  {freeMinutes % 60 > 0 ? `${freeMinutes % 60}m` : ""}
                  <small>vrij om in te plannen</small>
                </strong>
              </div>
              <ArrowUpRight size={16} />
            </button>
          </section>
          {storageError && (
            <div className="warning" role="alert">
              Lokale opslag is niet beschikbaar. Wijzigingen blijven alleen
              tijdens deze sessie bewaard.
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              <Check size={16} />
              {notice}
              <button
                aria-label="Melding sluiten"
                onClick={() => setNotice("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          <div className="main-grid">
            <section className="panel primary-panel">
              <div className="panel-title">
                <div>
                  <h2>
                    {tab === "Inbox"
                      ? "Je inbox"
                      : tab === "Taken"
                        ? "Je taken"
                        : tab === "Dagplanning"
                          ? "Je dagplanning"
                          : "Je antwoordconcepten"}{" "}
                    <span className="count-badge">
                      {tab === "Inbox"
                        ? 12
                        : tab === "Taken"
                          ? state.tasks.length
                          : tab === "Dagplanning"
                            ? scheduled.length
                            : state.drafts.length}
                    </span>
                  </h2>
                  <p>
                    {tab === "Inbox"
                      ? "Van een volle inbox naar een duidelijk volgende stap."
                      : tab === "Taken"
                        ? "Geaccepteerde voorstellen, klaar om op te pakken."
                        : tab === "Dagplanning"
                          ? "Maandag 26 oktober · 09:00 – 17:00"
                          : "Vooraf gemaakte voorbeelden. Controleer elk concept zelf."}
                  </p>
                </div>
                {tab === "Inbox" && (
                  <span className="small-label">VOORBEELDINBOX</span>
                )}
              </div>
              {tab === "Inbox" && (
                <>
                  <div className="inbox-tools">
                    <div className="filters">
                      {["Alle mails", "Aandacht nodig", "Ongelezen"].map(
                        (f) => (
                          <button
                            className={filter === f ? "selected" : ""}
                            onClick={() => setFilter(f)}
                            key={f}
                          >
                            {f}
                            {f === "Alle mails" && <span>12</span>}
                          </button>
                        ),
                      )}
                    </div>
                    <input
                      aria-label="Mails zoeken"
                      placeholder="Zoek in je inbox…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                  <div className="mail-list">
                    {shown.map((m) => (
                      <button
                        className={`mail-row ${state.read.includes(m.id) ? "read" : ""}`}
                        key={m.id}
                        onClick={() => openMail(m)}
                      >
                        <span className={`avatar ${m.color}`}>
                          {m.name
                            .split(" ")
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join("")}
                        </span>
                        <span className="mail-copy">
                          <span className="sender-line">
                            <strong>{m.name}</strong>
                            <span>{m.company}</span>
                          </span>
                          <span className="subject">{m.subject}</span>
                          <span className="preview">{m.preview}</span>
                          <span
                            className={`mail-label ${accepted(m.id) ? "accepted" : ""}`}
                          >
                            {accepted(m.id) ? (
                              <Check size={11} />
                            ) : (
                              <Sparkles size={11} />
                            )}{" "}
                            {accepted(m.id)
                              ? "Taak toegevoegd"
                              : "Taakvoorstel klaar"}
                          </span>
                        </span>
                        <span className="mail-meta">
                          <time>{m.time}</time>
                          {!state.read.includes(m.id) && (
                            <span className="unread-dot" />
                          )}
                          <ChevronRight size={16} />
                        </span>
                      </button>
                    ))}
                    {shown.length === 0 && (
                      <div className="empty">
                        Geen mails gevonden. Probeer een andere zoekterm of
                        filter.
                      </div>
                    )}
                  </div>
                </>
              )}
              {tab === "Taken" && (
                <div className="task-list">
                  {state.tasks.map((t) => (
                    <article
                      className={`task-card ${t.done ? "done" : ""}`}
                      key={t.id}
                    >
                      <button
                        className="check-button"
                        aria-label={
                          t.done ? `Heropen ${t.title}` : `Voltooi ${t.title}`
                        }
                        onClick={() =>
                          update({
                            tasks: state.tasks.map((x) =>
                              x.id === t.id
                                ? { ...x, done: !x.done, start: undefined }
                                : x,
                            ),
                          })
                        }
                      >
                        {t.done && <Check size={16} />}
                      </button>
                      <div className="task-copy">
                        <h3>{t.title}</h3>
                        <div className="task-details">
                          <span
                            className={`priority ${t.priority.toLowerCase()}`}
                          >
                            {t.priority}
                          </span>
                          <span>
                            <Clock3 size={13} />
                            {t.duration} min
                          </span>
                          <span>
                            Uiterlijk{" "}
                            {new Date(
                              t.deadline + "T12:00:00",
                            ).toLocaleDateString("nl-NL", {
                              day: "numeric",
                              month: "short",
                            })}
                          </span>
                        </div>
                        <button
                          className="text-button"
                          onClick={() =>
                            openMail(mails.find((m) => m.id === t.mailId)!)
                          }
                        >
                          <MailIcon size={13} />
                          Bronmail bekijken
                        </button>
                      </div>
                      {!t.done && (
                        <button
                          className="secondary compact"
                          onClick={() => {
                            if (t.start !== undefined) {
                              setTab("Dagplanning");
                              return;
                            }
                            setPlanning(t);
                            setSlot("");
                          }}
                        >
                          {t.start !== undefined
                            ? `${time(t.start)} gepland`
                            : "Inplannen"}
                          <ChevronRight size={14} />
                        </button>
                      )}
                    </article>
                  ))}
                </div>
              )}
              {tab === "Dagplanning" && (
                <div className="schedule">
                  {Array.from({ length: 9 }, (_, i) => (
                    <div className="hour-line" key={i} style={{ top: i * 100 }}>
                      <time>{String(9 + i).padStart(2, "0")}:00</time>
                      <span />
                    </div>
                  ))}
                  {occupied.map((b, i) => (
                    <div
                      className={`event ${b.type === "Pauze" ? "break" : b.type === "Taak" ? "work" : "meeting"}`}
                      key={`${b.title}-${i}`}
                      style={{
                        top: ((b.start - 540) / 60) * 100,
                        height: (b.duration / 60) * 100 - 4,
                      }}
                    >
                      <strong>{b.title}</strong>
                      <span>
                        {time(b.start)} – {time(b.start + b.duration)} ·{" "}
                        {b.type}
                      </span>
                      {b.type === "Taak" && (
                        <button
                          aria-label={`Verwijder ${b.title} uit planning`}
                          onClick={() =>
                            update({
                              tasks: state.tasks.map((t) =>
                                t.title === b.title && t.start === b.start
                                  ? { ...t, start: undefined }
                                  : t,
                              ),
                            })
                          }
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {tab === "Antwoordconcepten" && (
                <div className="draft-list">
                  {state.drafts.map((d) => (
                    <DraftEditor
                      key={d.mailId}
                      draft={d}
                      onMail={() => openMail(mails[d.mailId - 1])}
                      onChange={(next) =>
                        setState((s) => ({
                          ...s,
                          drafts: s.drafts.map((x) =>
                            x.mailId === d.mailId ? next : x,
                          ),
                        }))
                      }
                    />
                  ))}
                  <p className="draft-footnote">
                    Goedkeuren is alleen een demostatus. Er wordt niets
                    verzonden.
                  </p>
                </div>
              )}
            </section>
            <aside className="right-column">
              <section className="panel today-card">
                <div className="mini-heading">
                  <span className="stat-icon green">
                    <CalendarDays size={19} />
                  </span>
                  <h2>Vandaag in balans</h2>
                </div>
                <p>Een realistisch plan begint met ruimte.</p>
                <div className="balance-bar">
                  <span style={{ width: `${(135 / 480) * 100}%` }} />
                  <span style={{ width: `${(plannedMinutes / 480) * 100}%` }} />
                </div>
                <div className="balance-legend">
                  <span>
                    <i className="legend-fixed" />
                    Afspraken & pauze
                  </span>
                  <b>2u 15m</b>
                  <span>
                    <i className="legend-task" />
                    Geplande taken
                  </span>
                  <b>{plannedMinutes} min</b>
                  <span>
                    <i className="legend-free" />
                    Vrije ruimte
                  </span>
                  <b>{freeMinutes} min</b>
                </div>
                <div className="divider" />
                <h3>Je volgende momenten</h3>
                {occupied
                  .slice()
                  .sort((a, b) => a.start - b.start)
                  .slice(0, 3)
                  .map((b) => (
                    <div className="upcoming" key={b.title}>
                      <time>{time(b.start)}</time>
                      <div>
                        <strong>{b.title}</strong>
                        <span>
                          {b.duration} minuten · {b.type}
                        </span>
                      </div>
                    </div>
                  ))}
                <button
                  className="text-button full"
                  onClick={() => setTab("Dagplanning")}
                >
                  Bekijk je dagplanning
                  <ArrowUpRight size={15} />
                </button>
              </section>
              <section className="tip-card">
                <Sparkles size={20} />
                <h3>Een beetje hulp, jij aan het stuur.</h3>
                <p>
                  Bij elke mail staat een taakvoorstel klaar. Pas het aan, kies
                  wat past en plan het op jouw moment.
                </p>
                <span>Geen automatische acties. Wel overzicht.</span>
              </section>
              <div className="local-note">
                <span className="status-dot" />
                {!ready
                  ? "Je werkplek laden…"
                  : storageError
                    ? "Alleen in deze sessie"
                    : "Je wijzigingen blijven in deze browser"}
              </div>
            </aside>
          </div>
          <footer>
            Gemaakt voor meer overzicht, niet voor een vollere dag.
            <span>PlannerPal · Interactief prototype</span>
            <button className="text-button" onClick={() => setReset(true)}>
              <RotateCcw size={12} />
              Voorbeelddata herstellen
            </button>
          </footer>
        </div>
      </main>
      {selected && (
        <div
          className="modal-backdrop"
          onClick={() => {
            setSelected(null);
            setProposal(null);
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mail-title"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") setSelected(null);
            }}
          >
            <button
              className="close"
              aria-label="Mail sluiten"
              onClick={() => {
                setSelected(null);
                setProposal(null);
              }}
              autoFocus
            >
              <X />
            </button>
            <span className="eyebrow">VOORBEELDMAIL</span>
            <h2 id="mail-title">{selected.subject}</h2>
            <div className="modal-sender">
              <span className={`avatar ${selected.color}`}>
                {selected.name[0]}
              </span>
              <div>
                <strong>{selected.name}</strong>
                <small>
                  {selected.company} · {selected.time}
                </small>
              </div>
            </div>
            <p className="mail-body">
              Hoi,
              <br />
              <br />
              {selected.body}
              <br />
              <br />
              Groet,
              <br />
              {selected.name.split(" ")[0]}
            </p>
            <div className="proposal-box">
              <div className="proposal-heading">
                <Sparkles size={18} />
                <strong>Voorgestelde volgende stap</strong>
                <span>Voorbeeld</span>
              </div>
              {accepted(selected.id) ? (
                <>
                  <p>Deze mail heeft al een taak in je takenlijst.</p>
                  <button
                    className="primary"
                    onClick={() => {
                      setSelected(null);
                      setTab("Taken");
                    }}
                  >
                    Bekijk de taak
                    <ChevronRight size={15} />
                  </button>
                </>
              ) : proposal ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    accept();
                  }}
                >
                  <label>
                    Taak
                    <input
                      required
                      maxLength={160}
                      value={proposal.title}
                      onChange={(e) =>
                        setProposal({ ...proposal, title: e.target.value })
                      }
                    />
                  </label>
                  <div className="form-grid">
                    <label>
                      Prioriteit
                      <select
                        value={proposal.priority}
                        onChange={(e) =>
                          setProposal({
                            ...proposal,
                            priority: e.target.value as Priority,
                          })
                        }
                      >
                        {["Hoog", "Normaal", "Laag"].map((p) => (
                          <option key={p}>{p}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Deadline
                      <input
                        type="date"
                        required
                        value={proposal.deadline}
                        onChange={(e) =>
                          setProposal({ ...proposal, deadline: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Duur (minuten)
                      <input
                        type="number"
                        min="5"
                        max="480"
                        required
                        value={proposal.duration}
                        onChange={(e) =>
                          setProposal({
                            ...proposal,
                            duration: Number(e.target.value),
                          })
                        }
                      />
                    </label>
                  </div>
                  <button className="primary" type="submit">
                    <Check size={16} />
                    Taak accepteren
                  </button>
                </form>
              ) : (
                <>
                  <h3>{selected.task}</h3>
                  <p>
                    {selected.duration} minuten · Prioriteit: {selected.priority.toLowerCase()}
                  </p>
                  <button
                    className="primary"
                    onClick={() =>
                      setProposal({
                        id: selected.id,
                        mailId: selected.id,
                        title: selected.task,
                        duration: selected.duration,
                        priority: selected.priority,
                        deadline: selected.deadline,
                        done: false,
                      })
                    }
                  >
                    Voorstel bekijken & aanpassen
                    <ChevronRight size={16} />
                  </button>
                </>
              )}
            </div>
            <button
              className="text-button"
              onClick={() => {
                setState((s) => ({
                  ...s,
                  drafts: s.drafts.some((d) => d.mailId === selected.id)
                    ? s.drafts
                    : [
                        ...s.drafts,
                        {
                          mailId: selected.id,
                          text: selected.reply,
                          approved: false,
                        },
                      ],
                }));
                setSelected(null);
                setTab("Antwoordconcepten");
              }}
            >
              Bekijk antwoordconcept
              <ArrowUpRight size={15} />
            </button>
          </section>
        </div>
      )}
      {planning && (
        <div className="modal-backdrop">
          <section
            className="modal small"
            role="dialog"
            aria-modal="true"
            aria-labelledby="plan-title"
          >
            <button
              autoFocus
              className="close"
              aria-label="Planning sluiten"
              onClick={() => setPlanning(null)}
            >
              <X />
            </button>
            <span className="eyebrow">MAAK RUIMTE VOOR WAT TELT</span>
            <h2 id="plan-title">Plan je taak</h2>
            <p>
              {planning.title} · {planning.duration} minuten
            </p>
            {freeSlots(planning).length ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const start = Number(slot);
                  if (slot === "" || !freeSlots(planning).includes(start))
                    return;
                  update({
                    tasks: state.tasks.map((t) =>
                      t.id === planning.id ? { ...t, start } : t,
                    ),
                  });
                  setPlanning(null);
                  setTab("Dagplanning");
                  setNotice("Je taak is ingepland, zonder overlap.");
                }}
              >
                <label>
                  Vrij moment op maandag 26 oktober
                  <select
                    required
                    value={slot}
                    onChange={(e) => setSlot(e.target.value)}
                  >
                    <option value="">Kies een starttijd</option>
                    {freeSlots(planning).map((s) => (
                      <option value={s} key={s}>
                        {time(s)} – {time(s + planning.duration)}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="primary" type="submit">
                  <CalendarDays size={16} />
                  Toevoegen aan dagplanning
                </button>
              </form>
            ) : (
              <div className="warning">
                Er is geen aaneengesloten ruimte voor deze taak. Haal eerst een
                andere taak uit de planning.
              </div>
            )}
          </section>
        </div>
      )}
      {reset && (
        <div className="modal-backdrop">
          <section
            className="modal small"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="reset-title"
          >
            <h2 id="reset-title">Opnieuw beginnen?</h2>
            <p>
              Je aangepaste taken, planning en concepten worden vervangen door
              de oorspronkelijke voorbeelddata.
            </p>
            <div className="button-row">
              <button
                autoFocus
                className="secondary"
                onClick={() => setReset(false)}
              >
                Annuleren
              </button>
              <button
                className="primary"
                onClick={() => {
                  setState(initialState());
                  setReset(false);
                  setSelected(null);
                  setPlanning(null);
                  setQuery("");
                  setFilter("Alle mails");
                  setNotice("Alle voorbeelddata is hersteld.");
                }}
              >
                Voorbeelddata herstellen
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
function DraftEditor({
  draft,
  onChange,
  onMail,
}: {
  draft: Draft;
  onChange: (d: Draft) => void;
  onMail: () => void;
}) {
  const m = mails[draft.mailId - 1];
  return (
    <article className="draft-card">
      <div className="draft-header">
        <div>
          <h3>{m.subject}</h3>
          <span>
            Aan {m.name} · {m.company}
          </span>
        </div>
        <span className={`approval ${draft.approved ? "approved" : ""}`}>
          {draft.approved ? "Goedgekeurd" : "Concept"}
        </span>
      </div>
      <label className="sr-only" htmlFor={`draft-${m.id}`}>
        Antwoord aan {m.name}
      </label>
      <textarea
        id={`draft-${m.id}`}
        value={draft.text}
        onChange={(e) =>
          onChange({ ...draft, text: e.target.value, approved: false })
        }
      />
      <div className="draft-actions">
        <button className="text-button" onClick={onMail}>
          <MailIcon size={14} />
          Bronmail
        </button>
        <button
          className={draft.approved ? "secondary" : "primary"}
          disabled={!draft.text.trim() || draft.approved}
          onClick={() => onChange({ ...draft, approved: true })}
        >
          <Check size={15} />
          {draft.approved ? "Goedgekeurd" : "Concept goedkeuren"}
        </button>
      </div>
    </article>
  );
}

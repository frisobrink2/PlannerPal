"use client";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Mail as MailIcon,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import {
  Block,
  demoDay,
  initialState,
  Mail,
  mails,
  Priority,
  State,
  Task,
  time,
} from "./data";
import {
  canFit,
  dateLabel,
  minutesLabel,
  restore,
  shiftDay,
  slotsFor,
  storageKey,
  validDate,
} from "./planning";
import { Dialog } from "./ui";

type Editor =
  | { kind: "task"; item: Task; fresh: boolean }
  | { kind: "block"; item: Block; fresh: boolean };
type Planning = { task: Task; date: string; start: string };
export default function Home() {
  const [state, setState] = useState<State>(initialState);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [date, setDate] = useState(demoDay);
  const [view, setView] = useState<"work" | "drafts">("work");
  const [mobile, setMobile] = useState("taken");
  const [search, setSearch] = useState("");
  const [mailFilter, setMailFilter] = useState("alle");
  const [taskFilter, setTaskFilter] = useState("dag");
  const [mail, setMail] = useState<Mail | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [plan, setPlan] = useState<Planning | null>(null);
  const [reset, setReset] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [undo, setUndo] = useState<State | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const saved = restore(JSON.parse(raw));
        if (saved) setState(saved);
        else
          setMessage(
            "Opgeslagen gegevens zijn ongeldig. De voorbeelddata is geladen.",
          );
      }
    } catch {
      setStorageError(true);
      setMessage("Opgeslagen gegevens konden niet worden geladen.");
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem(storageKey, JSON.stringify(state));
        setStorageError(false);
      } catch {
        setStorageError(true);
      }
  }, [state, ready]);
  function commit(next: State, text: string) {
    setUndo(state);
    setState(next);
    setMessage(text);
  }
  function openMail(m: Mail) {
    setMail(m);
    setState((s) => ({ ...s, read: [...new Set([...s.read, m.id])] }));
    setUndo(null);
  }
  function edit(value: Editor) {
    setError("");
    setEditor(value);
  }
  function patchEditor(
    patch: Partial<{ title: string; date: string; duration: number }>,
  ) {
    setEditor((current) =>
      current === null
        ? null
        : current.kind === "task"
          ? { ...current, item: { ...current.item, ...patch } }
          : { ...current, item: { ...current.item, ...patch } },
    );
  }
  function newTask() {
    edit({
      kind: "task",
      fresh: true,
      item: {
        id: Date.now(),
        mailId: null,
        title: "",
        duration: 30,
        date,
        deadline: date,
        priority: "Normaal",
        done: false,
      },
    });
  }
  function proposal(m: Mail) {
    setMail(null);
    edit({
      kind: "task",
      fresh: true,
      item: {
        id: Date.now(),
        mailId: m.id,
        title: m.task,
        duration: m.duration,
        date,
        deadline: m.deadline,
        priority: m.priority,
        done: false,
      },
    });
  }
  const active = state.tasks.filter((t) => !t.done);
  const dayTasks = active.filter((t) => t.date === date);
  const dayBlocks = state.blocks.filter((b) => b.date === date);
  const booked = dayTasks.filter((t) => t.start !== undefined);
  const unplanned = dayTasks.filter((t) => t.start === undefined);
  const blockedMinutes = dayBlocks.reduce((a, b) => a + b.duration, 0);
  const plannedMinutes = booked.reduce((a, t) => a + t.duration, 0);
  const free = 480 - blockedMinutes - plannedMinutes;
  const remaining = unplanned.reduce((a, t) => a + t.duration, 0);
  const taskList = state.tasks
    .filter((t) =>
      taskFilter === "alle"
        ? !t.done
        : taskFilter === "afgerond"
          ? t.done
          : !t.done && t.date === date,
    )
    .sort(
      (a, b) =>
        Number(a.start !== undefined) - Number(b.start !== undefined) ||
        ["Hoog", "Normaal", "Laag"].indexOf(a.priority) -
          ["Hoog", "Normaal", "Laag"].indexOf(b.priority),
    );
  const mailList = mails.filter(
    (m) =>
      (mailFilter !== "open" || !state.tasks.some((t) => t.mailId === m.id)) &&
      `${m.name} ${m.subject} ${m.body}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  function toggleTask(t: Task) {
    commit(
      {
        ...state,
        tasks: state.tasks.map((x) =>
          x.id === t.id ? { ...x, done: !x.done, start: undefined } : x,
        ),
      },
      t.done
        ? "Taak heropend. Plan hem opnieuw in."
        : "Taak afgerond. De geplande tijd is vrij.",
    );
  }
  function saveEditor() {
    if (!editor) return;
    const item = editor.item;
    if (!item.title.trim()) {
      setError("Geef een titel op.");
      return;
    }
    if (
      !validDate(item.date) ||
      !Number.isInteger(item.duration) ||
      item.duration < 5 ||
      item.duration > 480
    ) {
      setError("Kies een geldige dag en een duur van 5 tot 480 minuten.");
      return;
    }
    if (editor.kind === "task" && !validDate(editor.item.deadline)) {
      setError("Kies een geldige deadline.");
      return;
    }
    if (
      item.start !== undefined &&
      !canFit(state, item.date, item.start, item.duration, {
        kind: editor.kind,
        id: item.id,
      })
    ) {
      setError(
        "Dit tijdstip overlapt een taak, afspraak of pauze, of valt buiten 09:00–17:00. Kies een ander tijdstip of sla de taak ongepland op.",
      );
      return;
    }
    if (editor.kind === "task") {
      const task = { ...editor.item, title: editor.item.title.trim() };
      if (
        editor.fresh &&
        task.mailId !== null &&
        state.tasks.some((t) => t.mailId === task.mailId)
      ) {
        setError("Er bestaat al een taak voor deze mail.");
        return;
      }
      const drafts =
        task.mailId !== null &&
        !state.drafts.some((d) => d.mailId === task.mailId)
          ? [
              ...state.drafts,
              {
                mailId: task.mailId,
                text: mails.find((m) => m.id === task.mailId)!.reply,
                approved: false,
              },
            ]
          : state.drafts;
      commit(
        {
          ...state,
          tasks: editor.fresh
            ? [...state.tasks, task]
            : state.tasks.map((t) => (t.id === task.id ? task : t)),
          drafts,
        },
        editor.fresh ? "Taak toegevoegd." : "Taak bijgewerkt.",
      );
    } else {
      const block = { ...editor.item, title: editor.item.title.trim() };
      commit(
        {
          ...state,
          blocks: editor.fresh
            ? [...state.blocks, block]
            : state.blocks.map((b) => (b.id === block.id ? block : b)),
        },
        editor.fresh ? "Agendablok toegevoegd." : "Agendablok bijgewerkt.",
      );
    }
    setDate(item.date);
    setEditor(null);
    setMobile("taken");
  }
  function savePlan() {
    if (!plan || plan.start === "") return;
    const start = Number(plan.start);
    const current = state.tasks.find((t) => t.id === plan.task.id);
    if (
      !current ||
      !canFit(state, plan.date, start, current.duration, {
        kind: "task",
        id: current.id,
      })
    ) {
      setError("Dit moment is niet meer beschikbaar. Kies een ander tijdstip.");
      return;
    }
    commit(
      {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === current.id ? { ...t, date: plan.date, start } : t,
        ),
      },
      "Taak ingepland.",
    );
    setDate(plan.date);
    setPlan(null);
    setMobile("planning");
  }
  function openPlan(task: Task) {
    setError("");
    setPlan({
      task,
      date: task.date,
      start: task.start === undefined ? "" : String(task.start),
    });
  }
  const events = [
    ...dayBlocks.map((b) => ({ ...b, kind: "block" as const })),
    ...booked.map((t) => ({
      ...t,
      start: t.start!,
      type: "Taak" as const,
      kind: "task" as const,
    })),
  ].sort((a, b) => a.start - b.start);
  const mailTask = mail
    ? state.tasks.find((t) => t.mailId === mail.id)
    : undefined;
  return (
    <div className="app">
      <header className="top">
        <a
          className="wordmark"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setView("work");
          }}
        >
          planner<span>pal</span>
          <span className="brand-mark">/</span>
        </a>
        <nav aria-label="Hoofdnavigatie">
          <button
            className={view === "work" ? "current" : ""}
            onClick={() => setView("work")}
          >
            Werkoverzicht
          </button>
          <button
            className={view === "drafts" ? "current" : ""}
            onClick={() => setView("drafts")}
          >
            Antwoordconcepten{" "}
            <span>{state.drafts.filter((d) => !d.approved).length}</span>
          </button>
        </nav>
        <div className="top-actions">
          <span className="demo-badge">DEMO</span>
          <button
            className="icon-button"
            title="Voorbeelddata herstellen"
            aria-label="Voorbeelddata herstellen"
            onClick={() => setReset(true)}
          >
            <RotateCcw size={16} />
          </button>
          <span className="user-avatar">J</span>
        </div>
      </header>
      <div className="demo-note">
        Voorbeeldwerkplek <span>·</span> Mails, voorstellen en antwoorden zijn
        fictief. Er wordt niets verstuurd.
      </div>
      <main>
        <div className="heading">
          <div>
            <span className="overline">MIJN WERKDAG</span>
            <h1>
              {view === "work"
                ? "Wat pak je vandaag op?"
                : "Antwoorden die nog van jou moeten worden."}
            </h1>
            <p>
              {view === "work"
                ? "Maak van een mail een taak. Geef het werk daarna een plek in je dag."
                : "Controleer de inhoud, pas de tekst aan en keur je concept goed."}
            </p>
          </div>
          <button className="primary new-task" onClick={newTask}>
            <Plus size={16} />
            Nieuwe taak
          </button>
        </div>
        {storageError && (
          <div className="alert" role="alert">
            Opslaan in deze browser lukt niet. Wijzigingen verdwijnen mogelijk
            na herladen.
          </div>
        )}
        {message && (
          <div className="toast" role="status">
            <span>{message}</span>
            {undo && (
              <button
                onClick={() => {
                  setState(undo);
                  setUndo(null);
                  setMessage("Laatste actie ongedaan gemaakt.");
                }}
              >
                Ongedaan maken
              </button>
            )}
            <button
              className="icon-button"
              aria-label="Melding sluiten"
              onClick={() => {
                setMessage("");
                setUndo(null);
              }}
            >
              <X size={14} />
            </button>
          </div>
        )}
        {view === "work" ? (
          <>
            <section className="day-toolbar" aria-label="Geselecteerde werkdag">
              <div className="date-controls">
                <button
                  className="icon-button"
                  aria-label="Vorige dag"
                  disabled={date === "2000-01-01"}
                  onClick={() => setDate(shiftDay(date, -1))}
                >
                  <ArrowLeft size={16} />
                </button>
                <label className="day-picker">
                  <span>{dateLabel(date, true)}</span>
                  <input
                    aria-label="Werkdag"
                    type="date"
                    min="2000-01-01"
                    max="2100-12-31"
                    value={date}
                    onChange={(e) => {
                      if (validDate(e.target.value)) setDate(e.target.value);
                    }}
                  />
                  <ChevronDown size={14} />
                </label>
                <button
                  className="icon-button"
                  aria-label="Volgende dag"
                  disabled={date === "2100-12-31"}
                  onClick={() => setDate(shiftDay(date, 1))}
                >
                  <ArrowRight size={16} />
                </button>
                {date !== demoDay && (
                  <button
                    className="quiet demo-day"
                    onClick={() => setDate(demoDay)}
                  >
                    Voorbeelddag
                  </button>
                )}
              </div>
              <div className="capacity">
                <span>
                  <i />
                  {minutesLabel(free)} vrij
                </span>
                <span>{minutesLabel(remaining)} nog te plannen</span>
              </div>
            </section>
            <div
              className={`capacity-note ${remaining > free ? "overloaded" : ""}`}
              role={remaining > free ? "status" : undefined}
            >
              {remaining > free ? (
                <>
                  <strong>
                    {minutesLabel(remaining - free)} meer werk dan ruimte.
                  </strong>{" "}
                  Verplaats een taak naar een andere dag of maak tijd vrij.
                </>
              ) : unplanned.length ? (
                <>
                  <strong>
                    {unplanned.length}{" "}
                    {unplanned.length === 1 ? "taak heeft" : "taken hebben"} nog
                    geen tijdstip.
                  </strong>{" "}
                  {free > 0
                    ? "Plan een taak in of laat ruimte over."
                    : "De dag is vol. Verplaats werk naar een andere dag."}
                </>
              ) : (
                <>
                  <strong>
                    {free > 0 ? "Je hebt ruimte over." : "Je dag is ingepland."}
                  </strong>{" "}
                  {free > 0
                    ? "Voeg werk toe wanneer het past."
                    : "Houd het hierbij, of maak eerst tijd vrij."}
                </>
              )}
            </div>
            <nav className="mobile-tabs" aria-label="Werkoverzicht onderdelen">
              {[
                ["inbox", "Inbox"],
                ["taken", "Taken"],
                ["planning", "Planning"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  className={mobile === id ? "active" : ""}
                  onClick={() => setMobile(id)}
                >
                  {label}
                </button>
              ))}
            </nav>
            <div className="workspace">
              <section
                className={`column inbox-column ${mobile === "inbox" ? "mobile-visible" : ""}`}
                aria-labelledby="inbox-heading"
              >
                <div className="column-head">
                  <div>
                    <span className="step">01</span>
                    <h2 id="inbox-heading">
                      Inbox <span>{mails.length}</span>
                    </h2>
                  </div>
                  <span className="column-meta">Voorbeeldmails</span>
                </div>
                <div className="column-tools">
                  <div className="search">
                    <Search size={15} />
                    <input
                      aria-label="Mails zoeken"
                      placeholder="Zoek een mail"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <div className="filter-row">
                    <button
                      className={mailFilter === "alle" ? "active" : ""}
                      onClick={() => setMailFilter("alle")}
                    >
                      Alle mails
                    </button>
                    <button
                      className={mailFilter === "open" ? "active" : ""}
                      onClick={() => setMailFilter("open")}
                    >
                      Zonder taak
                    </button>
                  </div>
                </div>
                <div className="mail-list">
                  {mailList.map((m) => {
                    const task = state.tasks.find((t) => t.mailId === m.id);
                    return (
                      <button
                        key={m.id}
                        className={`mail-row ${state.read.includes(m.id) ? "read" : ""}`}
                        onClick={() => openMail(m)}
                      >
                        <div className="mail-from">
                          <span>{m.name}</span>
                          <time>{m.time}</time>
                        </div>
                        <h3>{m.subject}</h3>
                        <p>{m.body}</p>
                        <div className="mail-bottom">
                          <span>{m.company}</span>
                          <span className={task ? "has-task" : ""}>
                            {task ? (
                              <>
                                <Check size={11} />
                                {task.done ? "Afgerond" : "Taak gemaakt"}
                              </>
                            ) : (
                              <>
                                <Plus size={11} />
                                Taakvoorstel
                              </>
                            )}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                  {!mailList.length && (
                    <p className="empty">
                      Geen mails gevonden. Pas je zoekterm of filter aan.
                    </p>
                  )}
                </div>
                <div className="column-foot">
                  Alleen jij bepaalt welke mails een taak worden.
                </div>
              </section>
              <section
                className={`column tasks-column ${mobile === "taken" ? "mobile-visible" : ""}`}
                aria-labelledby="tasks-heading"
              >
                <div className="column-head">
                  <div>
                    <span className="step">02</span>
                    <h2 id="tasks-heading">
                      Taken <span>{taskList.length}</span>
                    </h2>
                  </div>
                  <button
                    className="icon-button"
                    aria-label="Nieuwe taak"
                    onClick={newTask}
                  >
                    <Plus size={18} />
                  </button>
                </div>
                <div className="column-tools">
                  <div className="task-summary">
                    <strong>
                      {minutesLabel(
                        dayTasks.reduce((a, t) => a + t.duration, 0),
                      )}
                    </strong>
                    <span>werk op {dateLabel(date)}</span>
                  </div>
                  <div className="filter-row">
                    {[
                      ["dag", "Deze dag"],
                      ["alle", "Alle open"],
                      ["afgerond", "Afgerond"],
                    ].map(([id, label]) => (
                      <button
                        key={id}
                        className={taskFilter === id ? "active" : ""}
                        onClick={() => setTaskFilter(id)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="task-list">
                  {taskList.map((t) => (
                    <article
                      className={`task-card ${t.done ? "done" : ""}`}
                      key={t.id}
                      data-task-id={t.id}
                    >
                      <div className="task-title">
                        <button
                          className="checkbox"
                          aria-label={`${t.done ? "Heropen" : "Voltooi"} ${t.title}`}
                          onClick={() => toggleTask(t)}
                        >
                          {t.done && <Check size={14} />}
                        </button>
                        <button
                          className="task-name"
                          onClick={() =>
                            edit({ kind: "task", item: { ...t }, fresh: false })
                          }
                        >
                          {t.title}
                        </button>
                        <button
                          className="icon-button edit-task"
                          aria-label={`Bewerk ${t.title}`}
                          onClick={() =>
                            edit({ kind: "task", item: { ...t }, fresh: false })
                          }
                        >
                          <MoreHorizontal size={17} />
                        </button>
                      </div>
                      <div className="task-content">
                        <div className="task-details">
                          <span
                            className={`priority ${t.priority.toLowerCase()}`}
                          >
                            {t.priority}
                          </span>
                          <span>
                            <Clock3 size={12} />
                            {t.duration} min
                          </span>
                          <span
                            className={
                              t.deadline < date && !t.done ? "late" : ""
                            }
                          >
                            Voor{" "}
                            {new Date(
                              t.deadline + "T12:00:00",
                            ).toLocaleDateString("nl-NL", {
                              day: "numeric",
                              month: "short",
                            })}
                          </span>
                        </div>
                        {t.date !== date && (
                          <span className="other-day">
                            Werkdag: {dateLabel(t.date)}
                          </span>
                        )}
                        <div className="task-actions">
                          {t.mailId !== null ? (
                            <button
                              className="source"
                              onClick={() =>
                                openMail(mails.find((m) => m.id === t.mailId)!)
                              }
                            >
                              <MailIcon size={12} />
                              Bronmail
                            </button>
                          ) : (
                            <span className="manual-label">
                              Zelf toegevoegd
                            </span>
                          )}
                          {!t.done && (
                            <button
                              className={`plan-button ${t.start !== undefined ? "planned" : ""}`}
                              onClick={() => openPlan(t)}
                            >
                              {t.start !== undefined
                                ? `${time(t.start)} · Verplaatsen`
                                : "Inplannen"}
                              <ArrowRight size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
                  {!taskList.length && (
                    <div className="empty">
                      <h3>
                        {taskFilter === "afgerond"
                          ? "Nog geen afgeronde taken."
                          : "Geen taken in dit overzicht."}
                      </h3>
                      <p>
                        {taskFilter === "dag"
                          ? "Voeg een taak toe of verplaats werk uit ‘Alle open’ naar deze dag."
                          : "Maak een taak aan of kies een ander filter."}
                      </p>
                      <button className="secondary" onClick={newTask}>
                        <Plus size={14} />
                        Taak toevoegen
                      </button>
                    </div>
                  )}
                </div>
                <button className="add-task-row" onClick={newTask}>
                  <Plus size={16} />
                  Taak toevoegen zonder mail
                </button>
              </section>
              <section
                className={`column agenda-column ${mobile === "planning" ? "mobile-visible" : ""}`}
                aria-labelledby="agenda-heading"
              >
                <div className="column-head">
                  <div>
                    <span className="step">03</span>
                    <h2 id="agenda-heading">Dagplanning</h2>
                  </div>
                  <button
                    className="icon-button"
                    aria-label="Afspraak of pauze toevoegen"
                    onClick={() =>
                      edit({
                        kind: "block",
                        fresh: true,
                        item: {
                          id: Date.now(),
                          date,
                          title: "",
                          type: "Afspraak",
                          start: 540,
                          duration: 30,
                        },
                      })
                    }
                  >
                    <Plus size={18} />
                  </button>
                </div>
                <div className="agenda-intro">
                  <span>09:00 — 17:00</span>
                  <span>{minutesLabel(free)} beschikbaar</span>
                </div>
                <div className="agenda-legend">
                  <span>
                    <i />
                    Werk
                  </span>
                  <span>
                    <i />
                    Afspraak
                  </span>
                  <span>
                    <i />
                    Pauze
                  </span>
                </div>
                <div
                  className="timeline-scroll"
                  tabIndex={0}
                  role="region"
                  aria-label="Tijdlijn van 09:00 tot 17:00"
                >
                  <div className="timeline">
                    {Array.from({ length: 9 }, (_, i) => (
                      <div
                        className="hour-line"
                        style={{ top: `calc(${i} * var(--hour-height))` }}
                        key={i}
                      >
                        <time>{String(i + 9).padStart(2, "0")}:00</time>
                        <span />
                      </div>
                    ))}
                    {events.map((event) => (
                      <button
                        key={`${event.kind}-${event.id}`}
                        className={`event ${event.duration < 45 ? "short-event" : ""} ${event.type === "Taak" ? "work" : event.type === "Pauze" ? "break" : "meeting"}`}
                        aria-label={`${event.type}: ${event.title}, ${time(event.start)} tot ${time(event.start + event.duration)}`}
                        title={`${event.title} · ${time(event.start)}–${time(event.start + event.duration)}`}
                        style={{
                          top: `calc(${(event.start - 540) / 60} * var(--hour-height) + 2px)`,
                          height: `calc(${event.duration / 60} * var(--hour-height) - 3px)`,
                        }}
                        onClick={() =>
                          event.kind === "task"
                            ? openPlan(event as Task)
                            : edit({
                                kind: "block",
                                item: event as Block,
                                fresh: false,
                              })
                        }
                      >
                        <strong>{event.title}</strong>
                        <span>
                          {time(event.start)}–
                          {time(event.start + event.duration)} · {event.type}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="agenda-footer">
                  Klik op een blok om het aan te passen.
                </div>
              </section>
            </div>
          </>
        ) : (
          <section className="drafts-view">
            <div className="drafts-summary">
              <h2>
                Te controleren{" "}
                <span>{state.drafts.filter((d) => !d.approved).length}</span>
              </h2>
              <p>
                Goedkeuren verandert alleen de status. Er wordt niets verzonden.
              </p>
            </div>
            <div className="draft-grid">
              {state.drafts.map((d) => {
                const m = mails.find((m) => m.id === d.mailId)!;
                return (
                  <article className="draft-card" key={d.mailId}>
                    <header>
                      <div>
                        <span className="overline">
                          AAN {m.name.toUpperCase()}
                        </span>
                        <h3>{m.subject}</h3>
                      </div>
                      <span
                        className={`draft-status ${d.approved ? "approved" : ""}`}
                      >
                        {d.approved ? "Goedgekeurd" : "Concept"}
                      </span>
                    </header>
                    <label className="sr-only" htmlFor={`draft-${d.mailId}`}>
                      Antwoord aan {m.name}
                    </label>
                    <textarea
                      id={`draft-${d.mailId}`}
                      value={d.text}
                      onChange={(e) => {
                        setUndo(null);
                        setState((s) => ({
                          ...s,
                          drafts: s.drafts.map((x) =>
                            x.mailId === d.mailId
                              ? { ...x, text: e.target.value, approved: false }
                              : x,
                          ),
                        }));
                      }}
                    />
                    <div className="draft-actions">
                      <button className="source" onClick={() => openMail(m)}>
                        <MailIcon size={13} />
                        Bronmail
                      </button>
                      <button
                        className="primary"
                        disabled={d.approved || !d.text.trim()}
                        onClick={() =>
                          commit(
                            {
                              ...state,
                              drafts: state.drafts.map((x) =>
                                x.mailId === d.mailId
                                  ? { ...x, approved: true }
                                  : x,
                              ),
                            },
                            "Concept goedgekeurd. Er is niets verstuurd.",
                          )
                        }
                      >
                        <Check size={14} />
                        {d.approved ? "Goedgekeurd" : "Goedkeuren"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}
        <footer>
          <span className={`save-status ${storageError ? "failed" : ""}`}>
            <i />
            {!ready
              ? "Werkplek laden…"
              : storageError
                ? "Opslag niet beschikbaar"
                : "Bewaard in deze browser"}
          </span>
          <span>
            Geen account. Geen mailkoppeling. Jouw keuzes blijven lokaal.
          </span>
        </footer>
      </main>
      {mail && (
        <Dialog
          title={mail.subject}
          label="Voorbeeldmail"
          side
          onClose={() => setMail(null)}
        >
          <div className="mail-person">
            <span className="person-avatar">{mail.name[0]}</span>
            <div>
              <strong>{mail.name}</strong>
              <span>
                {mail.company} · {mail.time}
              </span>
            </div>
          </div>
          <div className="mail-body">
            Hoi,
            <br />
            <br />
            {mail.body}
            <br />
            <br />
            Groet,
            <br />
            {mail.name.split(" ")[0]}
          </div>
          <section className="proposal">
            <span className="overline">VOORGESTELDE TAAK · VAST VOORBEELD</span>
            <h3>{mailTask?.title ?? mail.task}</h3>
            <p>
              {mailTask
                ? "Deze mail heeft al een taak."
                : `${mail.duration} minuten · Prioriteit: ${mail.priority.toLowerCase()}`}
            </p>
            {mailTask ? (
              <button
                className="primary"
                onClick={() => {
                  setMail(null);
                  edit({ kind: "task", item: { ...mailTask }, fresh: false });
                }}
              >
                Taak aanpassen
                <ArrowRight size={15} />
              </button>
            ) : (
              <button className="primary" onClick={() => proposal(mail)}>
                Taakvoorstel aanpassen
                <ArrowRight size={15} />
              </button>
            )}
          </section>
          <button
            className="secondary wide"
            onClick={() => {
              setUndo(null);
              setState((s) => ({
                ...s,
                drafts: s.drafts.some((d) => d.mailId === mail.id)
                  ? s.drafts
                  : [
                      ...s.drafts,
                      { mailId: mail.id, text: mail.reply, approved: false },
                    ],
              }));
              setMail(null);
              setView("drafts");
            }}
          >
            Antwoord controleren
            <ArrowRight size={15} />
          </button>
        </Dialog>
      )}
      {editor && (
        <Dialog
          title={
            editor.kind === "task"
              ? editor.fresh
                ? editor.item.mailId === null
                  ? "Nieuwe taak"
                  : "Taakvoorstel aanpassen"
                : "Taak aanpassen"
              : editor.fresh
                ? "Afspraak of pauze toevoegen"
                : "Agendablok aanpassen"
          }
          label={editor.kind === "task" ? "TAAK" : "DAGPLANNING"}
          onClose={() => setEditor(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveEditor();
            }}
          >
            <label>
              Titel
              <input
                autoFocus
                required
                maxLength={160}
                value={editor.item.title}
                onChange={(e) => patchEditor({ title: e.target.value })}
              />
            </label>
            <div className="form-grid">
              <label>
                Werkdag
                <input
                  type="date"
                  min="2000-01-01"
                  max="2100-12-31"
                  required
                  value={editor.item.date}
                  onChange={(e) => patchEditor({ date: e.target.value })}
                />
              </label>
              <label>
                Duur (minuten)
                <input
                  type="number"
                  min={5}
                  max={480}
                  step={1}
                  required
                  value={editor.item.duration || ""}
                  onChange={(e) =>
                    patchEditor({ duration: Number(e.target.value) })
                  }
                />
              </label>
            </div>
            {editor.kind === "task" ? (
              <>
                <div className="form-grid">
                  <label>
                    Prioriteit
                    <select
                      value={editor.item.priority}
                      onChange={(e) =>
                        setEditor({
                          ...editor,
                          item: {
                            ...editor.item,
                            priority: e.target.value as Priority,
                          },
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
                      min="2000-01-01"
                      max="2100-12-31"
                      required
                      value={editor.item.deadline}
                      onChange={(e) =>
                        setEditor({
                          ...editor,
                          item: { ...editor.item, deadline: e.target.value },
                        })
                      }
                    />
                  </label>
                </div>
                {!editor.item.done && (
                  <label>
                    Tijdstip
                    <select
                      value={editor.item.start ?? ""}
                      onChange={(e) => {
                        if (editor.kind === "task")
                          setEditor({
                            ...editor,
                            item: {
                              ...editor.item,
                              start:
                                e.target.value === ""
                                  ? undefined
                                  : Number(e.target.value),
                            },
                          });
                      }}
                    >
                      <option value="">Nog niet inplannen</option>
                      {Array.from(
                        new Set([
                          ...(editor.item.start !== undefined
                            ? [editor.item.start]
                            : []),
                          ...slotsFor(state, editor.item, editor.item.date),
                        ]),
                      )
                        .sort((a, b) => a - b)
                        .map((start) => (
                          <option key={start} value={start}>
                            {time(start)} – {time(start + editor.item.duration)}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                <p className="form-hint">
                  De werkdag bepaalt waar de taak verschijnt. De deadline blijft
                  staan als je de taak naar een andere dag verplaatst.
                </p>
              </>
            ) : (
              <div className="form-grid">
                <label>
                  Soort
                  <select
                    value={editor.item.type}
                    onChange={(e) => {
                      if (editor.kind === "block")
                        setEditor({
                          ...editor,
                          item: {
                            ...editor.item,
                            type: e.target.value as Block["type"],
                          },
                        });
                    }}
                  >
                    <option>Afspraak</option>
                    <option>Pauze</option>
                  </select>
                </label>
                <label>
                  Starttijd
                  <input
                    type="time"
                    required
                    min="09:00"
                    max="16:55"
                    value={time(editor.item.start)}
                    onChange={(e) => {
                      const [h, m] = e.target.value.split(":").map(Number);
                      setEditor({
                        ...editor,
                        item: { ...editor.item, start: h * 60 + m },
                      });
                    }}
                  />
                </label>
              </div>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="dialog-actions">
              {!editor.fresh && (
                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    const next =
                      editor.kind === "task"
                        ? {
                            ...state,
                            tasks: state.tasks.filter(
                              (t) => t.id !== editor.item.id,
                            ),
                          }
                        : {
                            ...state,
                            blocks: state.blocks.filter(
                              (b) => b.id !== editor.item.id,
                            ),
                          };
                    commit(
                      next,
                      editor.kind === "task"
                        ? "Taak verwijderd."
                        : "Agendablok verwijderd.",
                    );
                    setEditor(null);
                  }}
                >
                  Verwijderen
                </button>
              )}
              <button
                type="button"
                className="secondary"
                onClick={() => setEditor(null)}
              >
                Annuleren
              </button>
              <button className="primary" type="submit">
                {editor.fresh &&
                editor.kind === "task" &&
                editor.item.mailId !== null
                  ? "Taak accepteren"
                  : "Opslaan"}
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {plan && (
        <Dialog
          title="Taak inplannen"
          label="DAGPLANNING"
          onClose={() => setPlan(null)}
        >
          <h3 className="plan-task-title">{plan.task.title}</h3>
          <p className="form-hint">
            {plan.task.duration} minuten · Deadline{" "}
            {dateLabel(plan.task.deadline)}. Alleen vrije momenten worden
            aangeboden.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              savePlan();
            }}
          >
            <label>
              Werkdag
              <input
                type="date"
                required
                min="2000-01-01"
                max="2100-12-31"
                value={plan.date}
                onChange={(e) => {
                  setError("");
                  setPlan({ ...plan, date: e.target.value, start: "" });
                }}
              />
            </label>
            <label>
              Vrij moment
              <select
                value={plan.start}
                required
                onChange={(e) => setPlan({ ...plan, start: e.target.value })}
              >
                <option value="">Kies een starttijd</option>
                {slotsFor(state, plan.task, plan.date).map((start) => (
                  <option key={start} value={start}>
                    {time(start)} – {time(start + plan.task.duration)}
                  </option>
                ))}
              </select>
            </label>
            {slotsFor(state, plan.task, plan.date).length === 0 && (
              <p className="form-error">
                Geen aaneengesloten ruimte voor deze taak. Kies een andere dag
                of pas de agenda aan.
              </p>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="dialog-actions">
              {plan.task.start !== undefined && (
                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    commit(
                      {
                        ...state,
                        tasks: state.tasks.map((t) =>
                          t.id === plan.task.id
                            ? { ...t, start: undefined }
                            : t,
                        ),
                      },
                      "Taak uit de planning gehaald.",
                    );
                    setPlan(null);
                  }}
                >
                  Uit planning halen
                </button>
              )}
              <button className="primary" type="submit" disabled={!plan.start}>
                Inplannen
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {reset && (
        <Dialog
          title="Voorbeelddata herstellen?"
          label="OPNIEUW BEGINNEN"
          onClose={() => setReset(false)}
        >
          <p className="reset-description">
            Je taken, agenda en concepten worden vervangen door de
            oorspronkelijke voorbeelden. Je kunt dit daarna ongedaan maken.
          </p>
          <div className="dialog-actions">
            <button className="secondary" onClick={() => setReset(false)}>
              Annuleren
            </button>
            <button
              className="primary"
              onClick={() => {
                commit(initialState(), "Voorbeelddata hersteld.");
                setDate(demoDay);
                setTaskFilter("dag");
                setMailFilter("alle");
                setSearch("");
                setReset(false);
              }}
            >
              Herstellen
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

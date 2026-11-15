// TaskTracker.jsx - the Task Tracking module page.
//
// There is NO login here. The library already logged the user in, so this page just
// receives the logged-in user and token as props:
//
//     <TaskTracker user={user} token={token} />
//
// user.role decides what is shown: students get quizzes / assignments / daily practice,
// faculty get the same lists plus Create and Reports.
import { useCallback, useEffect, useMemo, useState } from "react";
import { createApi } from "./taskApi";
import QuizPlayer from "./QuizPlayer";
import { CreatePanel, ReportPanel } from "./FacultyPanel";
import "./tasks.css";

const MAX_FILE = 80 * 1024; // the backend accepts JSON up to 100 KB

const fmt = (n) => Number(n).toFixed(2);

function Badge({ type }) {
  return <span className={"tt-badge tt-badge-" + String(type).toLowerCase().replace(/[^a-z]/g, "")}>{type}</span>;
}

// ------------------------------------------------------------------ assignments (student)
function AssignmentUpload({ a, api, onDone, notify }) {
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const pick = (e) => {
    const f = e.target.files[0];
    setError("");
    setFile(null);
    if (!f) return;
    if (f.size > MAX_FILE) return setError("File is too large. Keep the answer under 80 KB (plain text).");
    if (!/\.txt$/i.test(f.name) && !f.type.startsWith("text/")) return setError("Please upload a plain text (.txt) file.");
    setFile(f);
  };

  const submit = async () => {
    if (!file) return setError("Choose your .txt answer file first.");
    setBusy(true);
    setError("");
    try {
      const text = await file.text();
      const r = await api.post(`/api/tasks/assignments/${a.id}/submit`, { fileName: file.name, text });
      notify(`Submitted. You scored ${fmt(r.score)} / ${fmt(r.total)}.`);
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tt-upload">
      <label className="tt-field">
        <span>Upload your answer (.txt)</span>
        <input type="file" accept=".txt,text/plain" onChange={pick} />
      </label>
      {error && <div className="tt-alert tt-alert-error" role="alert">{error}</div>}
      <button className="tt-btn tt-btn-primary" onClick={submit} disabled={busy || !file}>{busy ? "Checking..." : "Submit for checking"}</button>
    </div>
  );
}

function AssignmentCard({ a, role, api, refresh, notify }) {
  const sub = a.mySubmission;
  const remove = async () => {
    if (!window.confirm(`Delete "${a.title}" and all its submissions?`)) return;
    try {
      await api.del(`/api/tasks/assignments/${a.id}`);
      notify("Assignment deleted.");
      refresh();
    } catch (e) {
      notify(e.message, true);
    }
  };
  return (
    <div className="tt-card">
      <div className="tt-card-head">
        <Badge type={a.kind} />
        <span className="tt-muted">{a.subjectName} · {a.maxMarks} marks</span>
      </div>
      <p className="tt-card-title">{a.title}</p>
      {role === "faculty" ? (
        <>
          <p className="tt-muted">{a.submissions} submission(s)</p>
          <div className="tt-chips">{a.keys.map((k, i) => <span className="tt-chip" key={i}>{k}</span>)}</div>
          <button className="tt-btn tt-btn-danger" onClick={remove}>Delete</button>
        </>
      ) : sub ? (
        <div className="tt-result">
          <b>Score: {fmt(sub.score)} / {fmt(sub.total)}</b>
          <p className="tt-muted">Keys found: {sub.matched} of {sub.totalKeys} · file: {sub.fileName}</p>
          {sub.missing.length > 0 && (
            <>
              <p className="tt-muted">Topics missing from your answer:</p>
              <div className="tt-chips">{sub.missing.map((k, i) => <span className="tt-chip tt-chip-miss" key={i}>{k}</span>)}</div>
            </>
          )}
        </div>
      ) : (
        <AssignmentUpload a={a} api={api} onDone={refresh} notify={notify} />
      )}
    </div>
  );
}

// ------------------------------------------------------------------ daily practice
function DailyQuestion({ taskId, index, q, api, onSaved, notify }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await api.post(`/api/tasks/daily/${taskId}/answer`, { qIndex: index, answer: text });
      notify("Answer saved.");
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tt-dq">
      <p className="tt-qtext"><b>Q{index + 1}.</b> {q.text}</p>
      {q.answered ? (
        <>
          <div className="tt-myans"><b>Your answer:</b> {q.myAnswer}</div>
          {q.model && <div className="tt-model"><b>Model answer:</b> {q.model}</div>}
        </>
      ) : (
        <>
          <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Type your answer here" maxLength={2000} aria-label={`Answer to question ${index + 1}`} />
          {error && <div className="tt-alert tt-alert-error" role="alert">{error}</div>}
          <button className="tt-btn tt-btn-primary" onClick={save} disabled={busy || !text.trim()}>{busy ? "Saving..." : "Check my answer"}</button>
        </>
      )}
    </div>
  );
}

function DailyCard({ d, role, api, refresh, notify }) {
  const remove = async () => {
    if (!window.confirm(`Delete today's questions on "${d.topic}"?`)) return;
    try {
      await api.del(`/api/tasks/daily/${d.id}`);
      notify("Daily task deleted.");
      refresh();
    } catch (e) {
      notify(e.message, true);
    }
  };
  return (
    <div className="tt-card">
      <div className="tt-card-head">
        <Badge type="Daily" />
        <span className="tt-muted">{d.subjectName} · {d.date}</span>
      </div>
      <p className="tt-card-title">Today in class: {d.topic}</p>
      {d.questions.map((q, i) =>
        role === "faculty" ? (
          <div className="tt-dq" key={i}>
            <p className="tt-qtext"><b>Q{i + 1}.</b> {q.text}</p>
            {q.model && <div className="tt-model"><b>Model answer:</b> {q.model}</div>}
          </div>
        ) : (
          <DailyQuestion key={i} taskId={d.id} index={i} q={q} api={api} onSaved={refresh} notify={notify} />
        )
      )}
      {role === "faculty" && <button className="tt-btn tt-btn-danger" onClick={remove}>Delete</button>}
    </div>
  );
}

// ------------------------------------------------------------------ main page
export default function TaskTracker({ user, token }) {
  const api = useMemo(() => createApi(token), [token]); // stable, so child effects do not re-run
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("home");
  const [quiz, setQuiz] = useState(null); // { id, mode }
  const [toast, setToast] = useState(null);
  const [createKind, setCreateKind] = useState("quiz");
  const [createSubject, setCreateSubject] = useState(undefined);

  const refresh = useCallback(async () => {
    try {
      setData(await api.get("/api/tasks/overview"));
      setError("");
    } catch (e) {
      setError(e.status === 401 ? "Your session has expired. Please log in again." : e.message);
    }
  }, [api]);

  useEffect(() => {
    if (token) refresh();
  }, [token, refresh]);

  const notify = useCallback((message, isError = false) => {
    setToast({ message, isError });
    setTimeout(() => setToast(null), 4000);
  }, []);

  if (!user || !token) return <div className="tt-root"><div className="tt-alert">Please log in to the library first.</div></div>;
  if (error && !data) return <div className="tt-root"><div className="tt-alert tt-alert-error" role="alert">{error}</div><button className="tt-btn" onClick={refresh}>Try again</button></div>;
  if (!data) return <div className="tt-root"><p className="tt-muted">Loading your tasks...</p></div>;

  const role = data.user.role === "faculty" ? "faculty" : "student";

  if (quiz)
    return (
      <div className="tt-root">
        <QuizPlayer quizId={quiz.id} mode={quiz.mode} api={api} onClose={(changed) => { setQuiz(null); if (changed) refresh(); }} />
      </div>
    );

  const tabs = [["home", "Home"], ["quizzes", "Quizzes"], ["assignments", "Assignments"], ["daily", "Daily practice"]];
  if (role === "faculty") tabs.push(["create", "Create"], ["report", "Reports"]);

  const goCreate = (kind, subjectId) => {
    setCreateKind(kind);
    setCreateSubject(subjectId);
    setTab("create");
  };

  const removeQuiz = async (q) => {
    if (!window.confirm(`Delete "${q.title}" and all its results?`)) return;
    try {
      await api.del(`/api/tasks/quizzes/${q.id}`);
      notify("Quiz deleted.");
      refresh();
    } catch (e) {
      notify(e.message, true);
    }
  };

  const openPending = (p) => {
    if (p.type === "Quiz") setQuiz({ id: p.id, mode: "take" });
    else if (p.type === "Daily") setTab("daily");
    else setTab("assignments");
  };

  return (
    <div className="tt-root">
      <header className="tt-header">
        <div>
          <h1>Task Tracking</h1>
          <p className="tt-muted">{data.user.name} · {role === "faculty" ? "Faculty" : "Student"} · {data.today}</p>
        </div>
      </header>

      <nav className="tt-tabs" role="tablist">
        {tabs.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{label}</button>
        ))}
      </nav>

      {toast && <div className={"tt-toast" + (toast.isError ? " err" : "")} role="status">{toast.message}</div>}
      {error && <div className="tt-alert tt-alert-error" role="alert">{error}</div>}

      {/* ---------------------------------------------------------------- HOME */}
      {tab === "home" && role === "student" && (
        <section>
          <div className="tt-stats">
            <div className="tt-stat"><b>{data.pending.length}</b><span>pending</span></div>
            <div className="tt-stat"><b>{data.overall.total > 0 ? data.overall.percent + "%" : "-"}</b><span>overall score</span></div>
            <div className="tt-stat"><b>{data.quizzes.filter((q) => q.myResult).length}/{data.quizzes.length}</b><span>quizzes done</span></div>
          </div>
          <h2 className="tt-h2">To do (most urgent first)</h2>
          {data.subjects.length === 0 && <div className="tt-alert">You are not enrolled in any subject yet. Enrol in a subject in the Library to see its tasks.</div>}
          {data.subjects.length > 0 && data.pending.length === 0 && <div className="tt-alert tt-alert-ok">Nothing pending. Well done!</div>}
          <ul className="tt-list">
            {data.pending.map((p) => (
              <li key={p.type + p.id}>
                <Badge type={p.type} />
                <span className="tt-grow"><b>{p.title}</b><br /><span className="tt-muted">{p.subjectName}</span></span>
                <button className="tt-btn tt-btn-primary" onClick={() => openPending(p)}>{p.type === "Quiz" ? "Start quiz" : p.type === "Daily" ? "Practice" : "Open"}</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === "home" && role === "faculty" && (
        <section>
          {data.reminders.map((r) => (
            <div className="tt-alert tt-alert-warn" key={r.subjectId}>
              <b>Reminder:</b> you have not posted today's practice questions for <b>{r.subjectName}</b>.
              <button className="tt-btn tt-btn-primary" onClick={() => goCreate("daily", r.subjectId)}>Post now</button>
            </div>
          ))}
          {data.reminders.length === 0 && data.subjects.length > 0 && <div className="tt-alert tt-alert-ok">Today's practice questions are posted for all your subjects.</div>}
          {data.subjects.length === 0 && <div className="tt-alert">You are not assigned to any subject yet. Create a subject in the Library first.</div>}
          <div className="tt-stats">
            <div className="tt-stat"><b>{data.quizzes.length}</b><span>quizzes</span></div>
            <div className="tt-stat"><b>{data.assignments.length}</b><span>assignments</span></div>
            <div className="tt-stat"><b>{data.daily.length}</b><span>daily sets today</span></div>
          </div>
          <div className="tt-row tt-wrap">
            <button className="tt-btn tt-btn-primary" onClick={() => goCreate("quiz")}>New weekly quiz</button>
            <button className="tt-btn tt-btn-primary" onClick={() => goCreate("assignment")}>New mid / end-sem assignment</button>
            <button className="tt-btn tt-btn-primary" onClick={() => goCreate("daily")}>Today's practice questions</button>
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------------- QUIZZES */}
      {tab === "quizzes" && (
        <section>
          {data.quizzes.length === 0 && <div className="tt-alert">No quizzes yet.</div>}
          <ul className="tt-list">
            {data.quizzes.map((q) => (
              <li key={q.id}>
                <Badge type="Quiz" />
                <span className="tt-grow">
                  <b>{q.title}</b><br />
                  <span className="tt-muted">{q.subjectName} · {q.questionCount} questions · {q.totalMarks} marks</span>
                  {role === "student" && q.myResult && <><br /><span className="tt-score">Finished: {fmt(q.myResult.score)} / {fmt(q.myResult.total)} ({q.myResult.percent}%)</span></>}
                  {role === "faculty" && <><br /><span className="tt-muted">{q.attempts} attempt(s)</span></>}
                </span>
                {role === "student" && (q.myResult
                  ? <button className="tt-btn" onClick={() => setQuiz({ id: q.id, mode: "review" })}>Review</button>
                  : <button className="tt-btn tt-btn-primary" onClick={() => setQuiz({ id: q.id, mode: "take" })}>Attempt quiz now</button>)}
                {role === "faculty" && <button className="tt-btn tt-btn-danger" onClick={() => removeQuiz(q)}>Delete</button>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---------------------------------------------------------------- ASSIGNMENTS */}
      {tab === "assignments" && (
        <section>
          {data.assignments.length === 0 && <div className="tt-alert">No assignments yet.</div>}
          {data.assignments.map((a) => <AssignmentCard key={a.id} a={a} role={role} api={api} refresh={refresh} notify={notify} />)}
        </section>
      )}

      {/* ---------------------------------------------------------------- DAILY */}
      {tab === "daily" && (
        <section>
          {role === "faculty" && data.reminders.map((r) => (
            <div className="tt-alert tt-alert-warn" key={r.subjectId}>
              Nothing posted today for <b>{r.subjectName}</b>.
              <button className="tt-btn tt-btn-primary" onClick={() => goCreate("daily", r.subjectId)}>Post now</button>
            </div>
          ))}
          {data.daily.length === 0 && role === "student" && <div className="tt-alert">Your faculty has not posted practice questions for today yet.</div>}
          {data.daily.map((d) => <DailyCard key={d.id} d={d} role={role} api={api} refresh={refresh} notify={notify} />)}
        </section>
      )}

      {/* ---------------------------------------------------------------- FACULTY ONLY */}
      {tab === "create" && role === "faculty" && (
        <CreatePanel
          subjects={data.subjects}
          api={api}
          initialKind={createKind}
          initialSubject={createSubject}
          onCreated={async (msg, kind) => {
            notify(msg);
            await refresh(); // load the new item first, then show the list
            setTab(kind === "quiz" ? "quizzes" : kind === "assignment" ? "assignments" : "daily");
          }}
        />
      )}
      {tab === "report" && role === "faculty" && <ReportPanel subjects={data.subjects} api={api} />}
    </div>
  );
}

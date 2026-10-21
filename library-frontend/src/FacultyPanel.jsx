// FacultyPanel.jsx - faculty only: create quizzes / assignments / daily questions, and the results report
import { useEffect, useState } from "react";

const LETTERS = ["a", "b", "c", "d"];
const blankQuestion = () => ({ text: "", options: ["", "", "", ""], correct: null, marks: 1 });
const blankDaily = () => ({ text: "", model: "" });

function SubjectSelect({ subjects, value, onChange }) {
  return (
    <label className="tt-field">
      <span>Subject</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {subjects.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
    </label>
  );
}

// ------------------------------------------------------------------ quiz builder
function QuizForm({ subjectId, api, onDone }) {
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState([blankQuestion()]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const setQ = (i, patch) => setQuestions((qs) => qs.map((q, k) => (k === i ? { ...q, ...patch } : q)));
  const setOpt = (i, o, v) => setQuestions((qs) => qs.map((q, k) => (k === i ? { ...q, options: q.options.map((x, j) => (j === o ? v : x)) } : q)));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!title.trim()) return setError("Give the quiz a title.");
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text.trim()) return setError(`Question ${i + 1}: write the question.`);
      if (q.options.some((o) => !o.trim())) return setError(`Question ${i + 1}: fill all four options.`);
      if (q.correct === null) return setError(`Question ${i + 1}: select the correct option (the key).`);
    }
    setBusy(true);
    try {
      await api.post("/api/tasks/quizzes", {
        subjectId,
        title,
        questions: questions.map((q) => ({ ...q, marks: Number(q.marks) || 1 })),
      });
      onDone("Quiz created.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="tt-form">
      <label className="tt-field">
        <span>Quiz title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Week 3 Quiz - Inheritance" maxLength={120} />
      </label>
      {questions.map((q, i) => (
        <fieldset className="tt-qedit" key={i}>
          <legend>Question {i + 1}</legend>
          <label className="tt-field">
            <span>Question text</span>
            <textarea rows={2} value={q.text} onChange={(e) => setQ(i, { text: e.target.value })} maxLength={500} />
          </label>
          {q.options.map((o, k) => (
            <div className="tt-optedit" key={k}>
              <input type="radio" name={"key" + i} checked={q.correct === k} onChange={() => setQ(i, { correct: k })} aria-label={`Option ${LETTERS[k]} is the correct answer`} />
              <span className="tt-letter">{LETTERS[k]}.</span>
              <input className="tt-grow" value={o} onChange={(e) => setOpt(i, k, e.target.value)} placeholder={`Option ${LETTERS[k]}`} maxLength={200} />
            </div>
          ))}
          <p className="tt-hint">Select the round button next to the correct option: this is the key used to score students.</p>
          <div className="tt-row tt-between">
            <label className="tt-field tt-inline">
              <span>Marks</span>
              <input type="number" min={1} max={100} value={q.marks} onChange={(e) => setQ(i, { marks: e.target.value })} />
            </label>
            {questions.length > 1 && (
              <button type="button" className="tt-btn tt-btn-danger" onClick={() => setQuestions((qs) => qs.filter((_, k) => k !== i))}>Remove question</button>
            )}
          </div>
        </fieldset>
      ))}
      {error && <div className="tt-alert tt-alert-error" role="alert">{error}</div>}
      <div className="tt-row">
        <button type="button" className="tt-btn" disabled={questions.length >= 50} onClick={() => setQuestions((qs) => [...qs, blankQuestion()])}>+ Add question</button>
        <button className="tt-btn tt-btn-primary" disabled={busy}>{busy ? "Saving..." : "Publish quiz"}</button>
      </div>
    </form>
  );
}

// ------------------------------------------------------------------ assignment form
function AssignmentForm({ subjectId, api, onDone }) {
  const [kind, setKind] = useState("Mid-Sem");
  const [title, setTitle] = useState("");
  const [maxMarks, setMaxMarks] = useState(10);
  const [keys, setKeys] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const keyList = keys.split("\n").map((k) => k.trim()).filter(Boolean);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!title.trim()) return setError("Give the assignment a title.");
    if (keyList.length === 0) return setError("Add at least one answer key (one per line).");
    setBusy(true);
    try {
      await api.post("/api/tasks/assignments", { subjectId, kind, title, maxMarks: Number(maxMarks), keys: keyList });
      onDone("Assignment uploaded.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="tt-form">
      <div className="tt-row tt-wrap">
        <label className="tt-field">
          <span>Type</span>
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option>Mid-Sem</option>
            <option>End-Sem</option>
          </select>
        </label>
        <label className="tt-field">
          <span>Maximum marks</span>
          <input type="number" min={1} max={1000} value={maxMarks} onChange={(e) => setMaxMarks(e.target.value)} />
        </label>
      </div>
      <label className="tt-field">
        <span>Title / question paper</span>
        <textarea rows={3} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Explain inheritance, virtual functions and templates with examples." maxLength={200} />
      </label>
      <label className="tt-field">
        <span>Answer keys: words or phrases a good answer must contain (one per line)</span>
        <textarea rows={6} value={keys} onChange={(e) => setKeys(e.target.value)} placeholder={"inheritance\nvirtual function\npolymorphism\ntemplate"} />
      </label>
      <p className="tt-hint">
        {keyList.length} key(s). Each student's uploaded .txt answer is checked by the C++ checker; marks = max marks × keys found ÷ total keys.
      </p>
      {error && <div className="tt-alert tt-alert-error" role="alert">{error}</div>}
      <button className="tt-btn tt-btn-primary" disabled={busy}>{busy ? "Saving..." : "Upload assignment"}</button>
    </form>
  );
}

// ------------------------------------------------------------------ daily questions form
function DailyForm({ subjectId, api, onDone }) {
  const [topic, setTopic] = useState("");
  const [qs, setQs] = useState([blankDaily(), blankDaily()]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const setQ = (i, patch) => setQs((a) => a.map((q, k) => (k === i ? { ...q, ...patch } : q)));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const filled = qs.filter((q) => q.text.trim());
    if (!topic.trim()) return setError("Write what you taught today.");
    if (filled.length === 0) return setError("Add at least one practice question.");
    setBusy(true);
    try {
      await api.post("/api/tasks/daily", { subjectId, topic, questions: filled });
      onDone("Today's practice questions are posted.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="tt-form">
      <label className="tt-field">
        <span>What did you teach in class today?</span>
        <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Constructors and destructors" maxLength={200} />
      </label>
      {qs.map((q, i) => (
        <fieldset className="tt-qedit" key={i}>
          <legend>Practice question {i + 1}</legend>
          <label className="tt-field">
            <span>Question</span>
            <textarea rows={2} value={q.text} onChange={(e) => setQ(i, { text: e.target.value })} maxLength={500} />
          </label>
          <label className="tt-field">
            <span>Model answer (shown to the student after they answer)</span>
            <textarea rows={2} value={q.model} onChange={(e) => setQ(i, { model: e.target.value })} maxLength={1000} />
          </label>
          {qs.length > 1 && (
            <button type="button" className="tt-btn tt-btn-danger" onClick={() => setQs((a) => a.filter((_, k) => k !== i))}>Remove</button>
          )}
        </fieldset>
      ))}
      {error && <div className="tt-alert tt-alert-error" role="alert">{error}</div>}
      <div className="tt-row">
        <button type="button" className="tt-btn" disabled={qs.length >= 30} onClick={() => setQs((a) => [...a, blankDaily()])}>+ Add question</button>
        <button className="tt-btn tt-btn-primary" disabled={busy}>{busy ? "Posting..." : "Post for students"}</button>
      </div>
    </form>
  );
}

// ------------------------------------------------------------------ create panel
export function CreatePanel({ subjects, api, initialKind = "quiz", initialSubject, onCreated }) {
  const editable = subjects.filter((s) => s.canEdit);
  const [kind, setKind] = useState(initialKind);
  const [subjectId, setSubjectId] = useState(initialSubject || (editable[0] && editable[0].id));

  useEffect(() => {
    setKind(initialKind);
  }, [initialKind]);
  useEffect(() => {
    if (initialSubject) setSubjectId(initialSubject);
  }, [initialSubject]);

  if (editable.length === 0)
    return <div className="tt-alert">You are not assigned to any subject yet. Create a subject in the Library first, then come back.</div>;

  const done = (msg) => onCreated(msg, kind);
  return (
    <div>
      <SubjectSelect subjects={editable} value={subjectId} onChange={setSubjectId} />
      <div className="tt-seg" role="tablist">
        {[["quiz", "Weekly quiz"], ["assignment", "Mid / End-sem assignment"], ["daily", "Daily practice"]].map(([k, label]) => (
          <button key={k} role="tab" aria-selected={kind === k} className={kind === k ? "on" : ""} onClick={() => setKind(k)}>{label}</button>
        ))}
      </div>
      {kind === "quiz" && <QuizForm key={"q" + subjectId} subjectId={subjectId} api={api} onDone={done} />}
      {kind === "assignment" && <AssignmentForm key={"a" + subjectId} subjectId={subjectId} api={api} onDone={done} />}
      {kind === "daily" && <DailyForm key={"d" + subjectId} subjectId={subjectId} api={api} onDone={done} />}
    </div>
  );
}

// ------------------------------------------------------------------ report panel
export function ReportPanel({ subjects, api }) {
  const editable = subjects.filter((s) => s.canEdit);
  const [subjectId, setSubjectId] = useState(editable[0] && editable[0].id);
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!subjectId) return;
    let alive = true;
    setReport(null);
    setError("");
    api.get(`/api/tasks/report/${subjectId}`).then((r) => alive && setReport(r)).catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [subjectId, api]);

  if (editable.length === 0) return <div className="tt-alert">No subject assigned to you yet.</div>;

  return (
    <div>
      <SubjectSelect subjects={editable} value={subjectId} onChange={setSubjectId} />
      {error && <div className="tt-alert tt-alert-error" role="alert">{error}</div>}
      {!report && !error && <p className="tt-muted">Loading report...</p>}
      {report && (
        <>
          <h3 className="tt-h3">Leaderboard</h3>
          {report.leaderboard.length === 0 ? (
            <p className="tt-muted">No students are enrolled or have attempted anything yet.</p>
          ) : (
            <div className="tt-tablewrap">
              <table className="tt-table">
                <thead>
                  <tr><th>#</th><th>Student</th><th>Quizzes</th><th>Assignments</th><th>Daily answers</th><th>Quiz %</th><th>Assignment %</th><th>Overall %</th></tr>
                </thead>
                <tbody>
                  {report.leaderboard.map((s, i) => (
                    <tr key={s.studentId}>
                      <td>{i + 1}</td><td>{s.name}</td><td>{s.quizzesDone}</td><td>{s.assignmentsDone}</td><td>{s.dailyAnswers}</td>
                      <td>{s.quizPercent}</td><td>{s.assignmentPercent}</td><td><b>{s.overallPercent}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h3 className="tt-h3">Quizzes</h3>
          {report.quizzes.length === 0 ? <p className="tt-muted">No quizzes yet.</p> : (
            <div className="tt-tablewrap"><table className="tt-table">
              <thead><tr><th>Quiz</th><th>Attempts</th><th>Average %</th></tr></thead>
              <tbody>{report.quizzes.map((q) => <tr key={q.id}><td>{q.title}</td><td>{q.attempts}</td><td>{q.averagePercent}</td></tr>)}</tbody>
            </table></div>
          )}

          <h3 className="tt-h3">Assignment submissions</h3>
          {report.assignments.length === 0 ? <p className="tt-muted">No assignments yet.</p> : report.assignments.map((a) => (
            <div key={a.id} className="tt-card">
              <b>{a.kind}: {a.title}</b> <span className="tt-muted">({a.maxMarks} marks)</span>
              {a.submissions.length === 0 ? <p className="tt-muted">No submissions yet.</p> : (
                <div className="tt-tablewrap"><table className="tt-table">
                  <thead><tr><th>Student</th><th>Score</th><th>Keys found</th><th>Missing keys</th><th>Checked by</th></tr></thead>
                  <tbody>{a.submissions.map((s, i) => (
                    <tr key={i}><td>{s.student}</td><td>{s.score} / {s.total}</td><td>{s.matched} / {s.totalKeys}</td><td>{s.missing.join(", ") || "-"}</td><td>{s.engine === "cpp" ? "C++ checker" : "JS fallback"}</td></tr>
                  ))}</tbody>
                </table></div>
              )}
            </div>
          ))}

          <h3 className="tt-h3">Daily practice posted</h3>
          {report.dailyTasks.length === 0 ? <p className="tt-muted">Nothing posted yet.</p> : (
            <div className="tt-tablewrap"><table className="tt-table">
              <thead><tr><th>Date</th><th>Topic</th><th>Questions</th><th>Student answers</th></tr></thead>
              <tbody>{report.dailyTasks.map((d) => <tr key={d.id}><td>{d.date}</td><td>{d.topic}</td><td>{d.questionCount}</td><td>{d.answers}</td></tr>)}</tbody>
            </table></div>
          )}
        </>
      )}
    </div>
  );
}

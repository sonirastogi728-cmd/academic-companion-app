// QuizPlayer.jsx - iLearn / Moodle style quiz page
//   attempt  : question card + "Quiz navigation" block
//   summary  : "Summary of attempt" table + "Submit all and finish"
//   review   : marks, grade and the faculty's correct answers
import { useEffect, useState } from "react";

const LETTERS = ["a", "b", "c", "d"];
const fmt = (n) => Number(n).toFixed(2);

export default function QuizPlayer({ quizId, mode, api, onClose }) {
  const [quiz, setQuiz] = useState(null);
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState([]);
  const [flags, setFlags] = useState([]);
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState("loading"); // loading | attempt | summary | review
  const [result, setResult] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (mode === "review") {
          const r = await api.get(`/api/tasks/quizzes/${quizId}/result`);
          if (!alive) return;
          setResult(r);
          setPhase("review");
        } else {
          const q = await api.get(`/api/tasks/quizzes/${quizId}`);
          if (!alive) return;
          setQuiz(q);
          setAnswers(q.questions.map(() => -1));
          setFlags(q.questions.map(() => false));
          setPhase("attempt");
        }
      } catch (e) {
        if (alive) setError(e.message);
      }
    })();
    return () => {
      alive = false;
    };
  }, [quizId, mode, api]);

  const leave = () => {
    if (phase === "attempt" || phase === "summary") {
      if (!window.confirm("Leave this attempt? Your answers have not been submitted and will be lost.")) return;
    }
    onClose(phase === "review");
  };

  const choose = (opt) => setAnswers((a) => a.map((v, i) => (i === idx ? opt : v)));
  const clearAnswer = () => choose(-1);
  const toggleFlag = () => setFlags((f) => f.map((v, i) => (i === idx ? !v : v)));

  const submit = async () => {
    setBusy(true);
    try {
      const r = await api.post(`/api/tasks/quizzes/${quizId}/submit`, { answers });
      setResult({ ...r, title: quiz.title });
      setConfirm(false);
      setPhase("review");
    } catch (e) {
      setConfirm(false);
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (error)
    return (
      <div className="tt-quiz">
        <div className="tt-crumbs">Quiz</div>
        <div className="tt-alert tt-alert-error" role="alert">{error}</div>
        <button className="tt-btn" onClick={() => onClose(true)}>Back to tasks</button>
      </div>
    );
  if (phase === "loading") return <div className="tt-quiz"><p className="tt-muted">Loading quiz...</p></div>;

  // ------------------------------------------------------------ review page
  if (phase === "review" && result) {
    return (
      <div className="tt-quiz">
        <div className="tt-crumbs">{quiz ? quiz.subjectName + " / " : ""}{result.title}</div>
        <h2 className="tt-h2">Quiz review</h2>
        <table className="tt-summary-table tt-review-head">
          <tbody>
            <tr><th>Status</th><td>Finished</td></tr>
            <tr><th>Marks</th><td>{fmt(result.score)}/{fmt(result.total)}</td></tr>
            <tr><th>Grade</th><td><b>{fmt(result.percent)}</b> out of 100.00</td></tr>
          </tbody>
        </table>
        {result.review.map((r, i) => (
          <div className="tt-review-q" key={i}>
            <div className="tt-review-info">
              <div className="tt-qno">Question <b>{i + 1}</b></div>
              <div className={"tt-state tt-state-" + r.status}>
                {r.status === "correct" ? "Correct" : r.status === "skipped" ? "Not answered" : "Incorrect"}
              </div>
              <div>Mark {fmt(r.marks)} out of {fmt(r.outOf)}</div>
            </div>
            <div className="tt-review-body">
              <p className="tt-qtext">{r.text}</p>
              {r.options.map((o, k) => (
                <div key={k} className={"tt-opt-review" + (k === r.correct ? " is-correct" : "") + (k === r.yourAnswer && k !== r.correct ? " is-wrong" : "")}>
                  <span className="tt-radio-dot">{k === r.yourAnswer ? "●" : "○"}</span>
                  <span className="tt-letter">{LETTERS[k]}.</span> {o}
                  {k === r.yourAnswer && <em className="tt-yours"> (your answer)</em>}
                </div>
              ))}
              <div className="tt-feedback">The correct answer is: <b>{LETTERS[r.correct]}. {r.options[r.correct]}</b></div>
            </div>
          </div>
        ))}
        <button className="tt-btn tt-btn-primary" onClick={() => onClose(true)}>Finish review</button>
      </div>
    );
  }

  const n = quiz.questions.length;
  const answered = answers.filter((a) => a >= 0).length;

  // ------------------------------------------------------------ summary page
  if (phase === "summary") {
    return (
      <div className="tt-quiz">
        <div className="tt-crumbs">{quiz.subjectName} / {quiz.title}</div>
        <h2 className="tt-h2">Summary of attempt</h2>
        <table className="tt-summary-table">
          <thead><tr><th>Question</th><th>Status</th></tr></thead>
          <tbody>
            {answers.map((a, i) => (
              <tr key={i}>
                <td><button className="tt-link" onClick={() => { setIdx(i); setPhase("attempt"); }}>{i + 1}{flags[i] ? " ⚑" : ""}</button></td>
                <td>{a >= 0 ? "Answer saved" : "Not yet answered"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="tt-muted">{answered} of {n} answered.</p>
        <div className="tt-row">
          <button className="tt-btn" onClick={() => setPhase("attempt")}>Return to attempt</button>
          <button className="tt-btn tt-btn-primary" onClick={() => setConfirm(true)}>Submit all and finish</button>
        </div>
        {confirm && (
          <div className="tt-modal-back" role="dialog" aria-modal="true" aria-label="Confirmation">
            <div className="tt-modal">
              <h3>Submit all and finish</h3>
              <p>Once you submit, you will no longer be able to change your answers for this attempt.</p>
              {answered < n && <p className="tt-warn">{n - answered} question(s) are not answered.</p>}
              <div className="tt-row tt-end">
                <button className="tt-btn" onClick={() => setConfirm(false)} disabled={busy}>Cancel</button>
                <button className="tt-btn tt-btn-primary" onClick={submit} disabled={busy}>{busy ? "Submitting..." : "Submit all and finish"}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ------------------------------------------------------------ attempt page
  const q = quiz.questions[idx];
  return (
    <div className="tt-quiz">
      <div className="tt-crumbs">{quiz.subjectName} / {quiz.title}</div>
      <h2 className="tt-h2">{quiz.title}</h2>
      <div className="tt-quiz-layout">
        <div className="tt-qcard">
          <div className="tt-qinfo">
            <div className="tt-qno">Question <b>{idx + 1}</b></div>
            <div className="tt-qstate">{answers[idx] >= 0 ? "Answered" : "Not yet answered"}</div>
            <div className="tt-qmarks">Marked out of {fmt(q.marks)}</div>
            <button className={"tt-flag" + (flags[idx] ? " on" : "")} onClick={toggleFlag}>
              {flags[idx] ? "⚑ Remove flag" : "⚐ Flag question"}
            </button>
          </div>
          <div className="tt-qbody">
            <p className="tt-qtext">{q.text}</p>
            <p className="tt-select-one">Select one:</p>
            {q.options.map((o, k) => (
              <label key={k} className={"tt-opt" + (answers[idx] === k ? " selected" : "")}>
                <input type="radio" name={"q" + idx} checked={answers[idx] === k} onChange={() => choose(k)} />
                <span className="tt-letter">{LETTERS[k]}.</span> {o}
              </label>
            ))}
            {answers[idx] >= 0 && <button className="tt-link" onClick={clearAnswer}>Clear my choice</button>}
          </div>
        </div>

        <aside className="tt-navblock" aria-label="Quiz navigation">
          <h3>Quiz navigation</h3>
          <div className="tt-navgrid">
            {answers.map((a, i) => (
              <button
                key={i}
                className={"tt-navbox" + (a >= 0 ? " answered" : "") + (i === idx ? " current" : "") + (flags[i] ? " flagged" : "")}
                onClick={() => setIdx(i)}
                aria-label={`Question ${i + 1}, ${a >= 0 ? "answered" : "not yet answered"}${flags[i] ? ", flagged" : ""}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <button className="tt-link" onClick={() => setPhase("summary")}>Finish attempt ...</button>
        </aside>
      </div>

      <div className="tt-row tt-between">
        <button className="tt-btn" onClick={leave}>Leave quiz</button>
        <div className="tt-row">
          <button className="tt-btn" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>Previous page</button>
          {idx < n - 1 ? (
            <button className="tt-btn tt-btn-primary" onClick={() => setIdx(idx + 1)}>Next page</button>
          ) : (
            <button className="tt-btn tt-btn-primary" onClick={() => setPhase("summary")}>Finish attempt ...</button>
          )}
        </div>
      </div>
    </div>
  );
}

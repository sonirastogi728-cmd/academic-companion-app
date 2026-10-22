import { useState, useEffect, useCallback } from "react";
import SubjectView from "./SubjectView";
import { getSubjects, addSubject, enroll, deleteSubject } from "../data/api";
export default function Dashboard({ user, onLogout }) {
  const isFaculty = user.role === "faculty";
  const [mine, setMine] = useState([]);
  const [all, setAll] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState("mine");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const m = await getSubjects("mine");
    if (m.ok) setMine(m.subjects);
    if (!isFaculty) {
      const a = await getSubjects("all");
      if (a.ok) setAll(a.subjects);
    }
  }, [isFaculty]);

  useEffect(() => { load(); }, [load]);

  async function handleAddSubject(e) {
    e.preventDefault();
    const res = await addSubject(name);
    setMessage(res.message);
    if (res.ok) { setName(""); load(); }
  }

  async function handleEnroll(id) {
    const res = await enroll(id);
    setMessage(res.message);
    if (res.ok) load();
  }

  async function handleDeleteSubject(id) {
  if (!window.confirm("Remove this subject with all its units, materials and enrollments?")) return;
  const res = await deleteSubject(id);
  setMessage(res.message);
  if (res.ok) load();
}

  return (
    <div className="dash">
      <header className="topbar">
        <div>
          <strong>{user.username}</strong>
          <span className="badge">{isFaculty ? "Faculty" : "Student"}</span>
        </div>
        <button onClick={onLogout}>Log out</button>
      </header>

      {selectedId ? (
        <SubjectView
          user={user}
          subjectId={selectedId}
          onBack={() => { setSelectedId(null); load(); }}
        />
      ) : (
        <>
          {!isFaculty && (
            <div className="tabs">
              <button className={tab === "mine" ? "active" : ""} onClick={() => setTab("mine")}>
                My subjects
              </button>
              <button className={tab === "browse" ? "active" : ""} onClick={() => setTab("browse")}>
                Browse &amp; enroll
              </button>
            </div>
          )}

          {isFaculty && (
            <div className="card">
              <h3>Add subject</h3>
              <form className="row" onSubmit={handleAddSubject}>
                <input placeholder="Subject name" value={name}
                  onChange={(e) => setName(e.target.value)} />
                <button type="submit">Add</button>
              </form>
            </div>
          )}

          {(isFaculty || tab === "mine") && (
            <div className="card">
              <h3>{isFaculty ? "Your subjects" : "Enrolled subjects"}</h3>
              {mine.length === 0 && <p className="muted">No subjects here yet.</p>}
              {mine.map((s) => (
  <div className="row" key={s.id}>
    <button className="subject-btn" onClick={() => setSelectedId(s.id)}>
      {s.name}
      <small>by {s.facultyName}</small>
    </button>
    {isFaculty && (
      <button className="danger" onClick={() => handleDeleteSubject(s.id)}>
        Remove
      </button>
    )}
  </div>
))}
            </div>
          )}

          {!isFaculty && tab === "browse" && (
            <div className="card">
              <h3>All subjects</h3>
              {all.length === 0 && <p className="muted">No subjects available.</p>}
              {all.map((s) => (
                <div className="row between" key={s.id}>
                  <span>{s.name} <small className="muted">by {s.facultyName}</small></span>
                  {s.enrolled ? (
                    <span className="badge">Enrolled</span>
                  ) : (
                    <button onClick={() => handleEnroll(s.id)}>Enroll</button>
                  )}
                </div>
              ))}
            </div>
          )}

          {message && <p className="message">{message}</p>}
        </>
      )}
    </div>
  );
}
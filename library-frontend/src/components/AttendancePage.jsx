import { useState, useEffect } from "react";
import { getSubjects, getRoster, markAttendance, getMyAttendance } from "../data/api";

const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local time

function FacultyMark() {
  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState("");
  const [students, setStudents] = useState([]);
  const [present, setPresent] = useState({});
  const [date, setDate] = useState(today());
  const [message, setMessage] = useState("");

  useEffect(() => {
    getSubjects("mine").then((r) => r.ok && setSubjects(r.subjects));
  }, []);

  async function pickSubject(id) {
    setSubjectId(id);
    setMessage("");
    if (!id) return setStudents([]);
    const r = await getRoster(id);
    if (!r.ok) return setMessage(r.message);
    setStudents(r.students);
    const all = {};
    r.students.forEach((s) => (all[s.id] = true)); // everyone present by default
    setPresent(all);
  }

  async function save() {
    const records = students.map((s) => ({ studentId: s.id, present: !!present[s.id] }));
    const r = await markAttendance(subjectId, date, records);
    setMessage(r.ok ? "Attendance saved." : r.message || "Could not save.");
  }

  return (
    <>
      <div className="row">
        <select value={subjectId} onChange={(e) => pickSubject(e.target.value)}>
          <option value="">Select subject</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      {subjectId && students.length === 0 && (
        <p className="muted">No students enrolled yet.</p>
      )}
      {students.map((s) => (
        <label className="row between" key={s.id}>
          <span>{s.username}</span>
          <input
            type="checkbox"
            checked={!!present[s.id]}
            onChange={(e) => setPresent({ ...present, [s.id]: e.target.checked })}
          />
        </label>
      ))}
      {students.length > 0 && <button onClick={save}>Save attendance</button>}
      {message && <p className="message">{message}</p>}
    </>
  );
}

function StudentView() {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    getMyAttendance().then((r) => r.ok && setRows(r.summary));
  }, []);

  if (rows.length === 0) return <p className="muted">No attendance marked yet.</p>;
  return rows.map((r) => (
    <div className="row between" key={r.subjectId}>
      <span>{r.subjectName}</span>
      <span>
        {r.attended}/{r.total} ({r.percent}%)
        {r.percent < 75 && <b style={{ color: "crimson" }}> ⚠ Low</b>}
      </span>
    </div>
  ));
}

export default function AttendancePage({ user, onBack }) {
  return (
    <div className="card">
      <button onClick={onBack}>← Back</button>
      <h3>Attendance</h3>
      {user.role === "faculty" ? <FacultyMark /> : <StudentView />}
    </div>
  );
}
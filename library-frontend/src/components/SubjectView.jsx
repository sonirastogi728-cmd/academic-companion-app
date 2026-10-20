import { useState, useEffect, useCallback } from "react";
import { getSubject, addUnit, addResource } from "../data/api";

export default function SubjectView({ subjectId, onBack }) {
  const [subject, setSubject] = useState(null);
  const [error, setError] = useState("");
  const [unitName, setUnitName] = useState("");
  const [unitId, setUnitId] = useState("");
  const [type, setType] = useState("PDF");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const res = await getSubject(subjectId);
    if (res.ok) setSubject(res.subject);
    else setError(res.message || "You cannot open this subject.");
  }, [subjectId]);

  useEffect(() => { load(); }, [load]);

  if (error)
    return (
      <div className="card">
        <p>{error}</p>
        <button onClick={onBack}>Back</button>
      </div>
    );
  if (!subject) return <p className="message">Loading...</p>;

  async function handleAddUnit(e) {
    e.preventDefault();
    const res = await addUnit(subjectId, unitName);
    setMessage(res.message);
    if (res.ok) { setUnitName(""); load(); }
  }

  async function handleAddResource(e) {
    e.preventDefault();
    const res = await addResource(subjectId, Number(unitId), title, type, location);
    setMessage(res.message);
    if (res.ok) { setTitle(""); setLocation(""); load(); }
  }

  return (
    <div>
      <button className="link-btn" onClick={onBack}>← Back</button>
      <div className="card">
        <h2>{subject.name}</h2>
        <p className="muted">by {subject.facultyName}</p>

        {subject.units.length === 0 && <p className="muted">No units yet.</p>}

        {subject.units.map((unit) => (
          <div className="unit-card" key={unit.id}>
            <h3>{unit.name}</h3>
            {unit.resources.length === 0 && (
              <p className="muted">(no material uploaded yet)</p>
            )}
            {unit.resources.map((r) => (
              <div className="resource-card" key={r.id}>
                <strong>[{r.type}]</strong>
                <span>{r.title}</span>
                {r.type === "LINK" ? (
                  <a href={r.location} target="_blank" rel="noreferrer">{r.location}</a>
                ) : (
                  <small>{r.location}</small>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {subject.canEdit && (
        <>
          <div className="card">
            <h3>Add unit</h3>
            <form className="row" onSubmit={handleAddUnit}>
              <input placeholder="Unit name" value={unitName}
                onChange={(e) => setUnitName(e.target.value)} />
              <button type="submit">Add</button>
            </form>
          </div>

          <div className="card">
            <h3>Add material</h3>
            <form onSubmit={handleAddResource}>
              <select value={unitId} onChange={(e) => setUnitId(e.target.value)}>
                <option value="">Choose unit…</option>
                {subject.units.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option>PDF</option>
                <option>PPT</option>
                <option>DOC</option>
                <option>LINK</option>
              </select>
              <input placeholder="Title" value={title}
                onChange={(e) => setTitle(e.target.value)} />
              <input placeholder="File name or URL" value={location}
                onChange={(e) => setLocation(e.target.value)} />
              <button type="submit">Add material</button>
            </form>
          </div>

          <div className="card">
            <h3>Students enrolled</h3>
            {subject.students.length === 0 ? (
              <p className="muted">(nobody yet)</p>
            ) : (
              <ul>{subject.students.map((n) => <li key={n}>{n}</li>)}</ul>
            )}
          </div>
        </>
      )}

      {message && <p className="message">{message}</p>}
    </div>
  );
}
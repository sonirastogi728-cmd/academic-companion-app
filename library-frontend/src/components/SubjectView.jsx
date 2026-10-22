import { useState, useEffect, useCallback } from "react";
import {
  getSubject, addUnit, deleteUnit, addResource, deleteResource, openFile,
} from "../data/api";

const formatSize = (b) =>
  b < 1024 * 1024 ? Math.max(1, Math.round(b / 1024)) + " KB" : (b / 1024 / 1024).toFixed(1) + " MB";

export default function SubjectView({ subjectId, onBack }) {
  const [subject, setSubject] = useState(null);
  const [error, setError] = useState("");
  const [unitName, setUnitName] = useState("");
  const [unitId, setUnitId] = useState("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [fileKey, setFileKey] = useState(0);
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
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

  async function handleDeleteUnit(id) {
    if (!window.confirm("Remove this unit and all its materials?")) return;
    const res = await deleteUnit(subjectId, id);
    setMessage(res.message);
    if (res.ok) {
      if (String(id) === String(unitId)) setUnitId("");
      load();
    }
  }
  async function handleAddResource(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const res = await addResource(subjectId, unitId, title, file, link);
    setBusy(false);
    setMessage(res.message);
    if (res.ok) {
      setTitle(""); setLink(""); setFile(null);
      setFileKey((k) => k + 1); // clears the file picker
      load();
    }
  }

  async function handleDeleteResource(rid) {
    if (!window.confirm("Remove this material?")) return;
    const res = await deleteResource(subjectId, rid);
    setMessage(res.message);
    if (res.ok) load();
  }

  async function handleOpen(r, download) {
    const res = await openFile(r, download);
    if (!res.ok) setMessage(res.message);
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
            <div className="row between">
              <h3>{unit.name}</h3>
              {subject.canEdit && (
                <button className="danger" onClick={() => handleDeleteUnit(unit.id)}>
                  Remove unit
                </button>
              )}
            </div>
            {unit.resources.length === 0 && (
              <p className="muted">(no material uploaded yet)</p>
            )}
            {unit.resources.map((r) => (
              <div className="resource-card" key={r.id}>
                <div className="row between">
                  <span>{r.title}</span>
                  {subject.canEdit && (
                    <button className="danger" onClick={() => handleDeleteResource(r.id)}>
                      Remove
                    </button>
                  )}
                </div>

                {r.storedName ? (
                  <div className="row">
                    <small className="grow">{r.originalName} ({formatSize(r.size)})</small>
                    <button onClick={() => handleOpen(r, false)}>View</button>
                    <button onClick={() => handleOpen(r, true)}>Download</button>
                  </div>
                ) : /^https?:\/\//i.test(r.location) ? (
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
              <input placeholder="Title" value={title}
                onChange={(e) => setTitle(e.target.value)} />
              <input key={fileKey} type="file"
                onChange={(e) => setFile(e.target.files[0] || null)} />
              <p className="muted">or paste a link instead</p>
              <input placeholder="https://..." value={link}
                onChange={(e) => setLink(e.target.value)} />
              <button type="submit" disabled={busy}>
                {busy ? "Uploading..." : "Add material"}
              </button>
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
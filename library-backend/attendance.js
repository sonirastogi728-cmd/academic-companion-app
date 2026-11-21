const { execFile } = require("child_process");
const path = require("path");

const CPP_DIR = path.join(__dirname, "cpp");
const EXE = path.join(CPP_DIR, "attendence.exe");

function runCpp(args, cb) {
  execFile(EXE, args.map(String), { cwd: CPP_DIR }, (err, stdout) => {
    try { cb(null, JSON.parse(stdout)); }
    catch { cb(new Error("C++ failed")); }
  });
}

module.exports = function (app, auth, db, canEdit) {
  const findSubject = (id) => db.subjects.find((s) => String(s.id) === String(id));
  const fail = (res, err) => res.status(500).json({ message: err.message });

  app.get("/api/attendance/roster/:subjectId", auth, (req, res) => {
    const sub = findSubject(req.params.subjectId);
    if (!sub) return res.status(404).json({ message: "Subject not found" });
    if (!canEdit(req.user, sub)) return res.status(403).json({ message: "Not your subject" });
    const students = db.enrollments
      .filter((e) => e.subjectId === sub.id)
      .map((e) => db.users.find((u) => u.id === e.studentId))
      .filter(Boolean)
      .map((u) => ({ id: u.id, username: u.username }));
    res.json({ students });
  });

  app.post("/api/attendance", auth, (req, res) => {
    const { subjectId, date, records } = req.body;
    const sub = findSubject(subjectId);
    if (!sub || !date || !Array.isArray(records))
      return res.status(400).json({ message: "Missing fields" });
    if (!canEdit(req.user, sub)) return res.status(403).json({ message: "Not your subject" });
    const recArgs = records.map((r) => `${r.studentId}:${r.present ? 1 : 0}`);
    runCpp(["mark", sub.id, date, ...recArgs], (err, data) =>
      err ? fail(res, err) : res.json(data));
  });

  app.get("/api/attendance/subject/:subjectId", auth, (req, res) => {
    const sub = findSubject(req.params.subjectId);
    if (!sub || !canEdit(req.user, sub)) return res.status(403).json({ message: "Not allowed" });
    runCpp(["subject", sub.id], (err, data) =>
      err ? fail(res, err) : res.json({ records: data }));
  });

  app.get("/api/attendance/me", auth, (req, res) => {
    runCpp(["student", req.user.id], (err, data) => {
      if (err) return fail(res, err);
      const summary = data.map((d) => {
        const s = findSubject(d.subjectId);
        return { ...d, subjectName: s ? s.name : d.subjectId };
      });
      res.json({ summary });
    });
  });
};
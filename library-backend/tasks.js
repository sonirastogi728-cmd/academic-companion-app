// ==========================================================================
//  tasks.js  -  Task Tracking module (backend)
//
//  Plugs into the existing library-backend Server.js.  It reuses the SAME
//  login, the SAME db.json and the SAME role / enrolment rules, so there is
//  no second login page.
//
//  In Server.js add (after your auth(), canEdit() and canAccess() helpers):
//      require("./tasks")({ app, db, save, auth, canEdit, canAccess });
//
//  New collections created inside db.json:
//      quizzes, assignments, dailyTasks, quizResults, submissions, dailyAnswers
//
//  Assignment checking is done by the C++ program in ./cpp (checker.cpp).
// ==========================================================================
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");

const CHECKER = path.join(__dirname, "cpp", process.platform === "win32" ? "checker.exe" : "checker");
const PRIORITY = { "End-Sem": 4, "Mid-Sem": 3, Quiz: 2, Daily: 1 };

module.exports = function mountTasks({ app, db, save, auth, canEdit, canAccess }) {
  for (const name of ["quizzes", "assignments", "dailyTasks", "quizResults", "submissions", "dailyAnswers"]) {
    if (!Array.isArray(db[name])) db[name] = [];
  }
  if (!Array.isArray(db.subjects)) db.subjects = [];

  // ------------------------------ helpers ------------------------------
  const same = (a, b) => String(a) === String(b);
  const newId = (list) => list.reduce((m, x) => Math.max(m, Number(x.id) || 0), 0) + 1;
  const isFaculty = (u) => u.role === "faculty";
  const subjectOf = (id) => db.subjects.find((s) => same(s.id, id));
  const subjectName = (s) => (s ? s.name || s.title || s.subjectName || `Subject ${s.id}` : "Unknown subject");
  const userName = (u) => u.name || u.fullName || u.username || `User ${u.id}`;
  const clean = (v, max = 300) => String(v ?? "").trim().slice(0, max);
  const pct = (score, total) => (total > 0 ? Math.round((score / total) * 1000) / 10 : 0);
  const round2 = (n) => Math.round(n * 100) / 100;
  const today = () => {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };

  class HttpError extends Error {
    constructor(status, message) {
      super(message);
      this.status = status;
    }
  }
  const fail = (status, message) => {
    throw new HttpError(status, message);
  };
  const handle = (fn) => async (req, res) => {
    try {
      await fn(req, res);
    } catch (e) {
      if (e instanceof HttpError) return res.status(e.status).json({ error: e.message });
      console.error("[tasks]", e);
      res.status(500).json({ error: "Something went wrong on the server." });
    }
  };

  const needFaculty = (req) => {
    if (!isFaculty(req.user)) fail(403, "Only faculty can do this.");
  };
  const needStudent = (req) => {
    if (isFaculty(req.user)) fail(403, "Only students can do this.");
  };
  const subjectForEdit = (req, id) => {
    const s = subjectOf(id);
    if (!s) fail(404, "Subject not found.");
    if (!isFaculty(req.user) || !canEdit(req.user, s)) fail(403, "You are not the faculty assigned to this subject.");
    return s;
  };
  const subjectForView = (req, id) => {
    const s = subjectOf(id);
    if (!s) fail(404, "Subject not found.");
    if (!canAccess(req.user, s)) fail(403, "You are not enrolled in this subject.");
    return s;
  };
  const mySubjects = (user) => db.subjects.filter((s) => canAccess(user, s));
  const myEditable = (user) => (isFaculty(user) ? db.subjects.filter((s) => canEdit(user, s)) : []);

  const quizTotal = (q) => q.questions.reduce((t, x) => t + x.marks, 0);

  // ------------------------------ views ------------------------------
  const quizCard = (q, user) => {
    const mine = db.quizResults.find((r) => r.quizId === q.id && same(r.studentId, user.id));
    const card = {
      id: q.id,
      subjectId: q.subjectId,
      subjectName: subjectName(subjectOf(q.subjectId)),
      title: q.title,
      questionCount: q.questions.length,
      totalMarks: quizTotal(q),
      createdAt: q.createdAt,
    };
    if (isFaculty(user)) card.attempts = db.quizResults.filter((r) => r.quizId === q.id).length;
    else card.myResult = mine ? { score: mine.score, total: mine.total, percent: pct(mine.score, mine.total) } : null;
    return card;
  };

  const assignmentCard = (a, user) => {
    const mine = db.submissions.find((s) => s.assignmentId === a.id && same(s.studentId, user.id));
    const card = {
      id: a.id,
      subjectId: a.subjectId,
      subjectName: subjectName(subjectOf(a.subjectId)),
      title: a.title,
      kind: a.kind,
      maxMarks: a.maxMarks,
      createdAt: a.createdAt,
    };
    if (isFaculty(user)) {
      card.keys = a.keys;
      card.submissions = db.submissions.filter((s) => s.assignmentId === a.id).length;
    } else {
      card.mySubmission = mine || null;
    }
    return card;
  };

  const dailyCard = (d, user) => {
    const mine = db.dailyAnswers.filter((x) => x.taskId === d.id && same(x.studentId, user.id));
    return {
      id: d.id,
      subjectId: d.subjectId,
      subjectName: subjectName(subjectOf(d.subjectId)),
      topic: d.topic,
      date: d.date,
      questions: d.questions.map((q, i) => {
        const a = mine.find((x) => x.qIndex === i);
        const item = { text: q.text, answered: !!a };
        if (isFaculty(user)) item.model = q.model;
        if (a) {
          item.myAnswer = a.answer;
          item.model = q.model;
        }
        return item;
      }),
    };
  };

  // ------------------------------ overview ------------------------------
  app.get(
    "/api/tasks/overview",
    auth,
    handle((req, res) => {
      const user = req.user;
      const ids = new Set(mySubjects(user).map((s) => String(s.id)));
      const inMine = (x) => ids.has(String(x.subjectId));

      const quizzes = db.quizzes.filter(inMine).map((q) => quizCard(q, user));
      const assignments = db.assignments.filter(inMine).map((a) => assignmentCard(a, user));
      const daily = db.dailyTasks.filter((d) => inMine(d) && d.date === today()).map((d) => dailyCard(d, user));

      const out = {
        user: { id: user.id, name: userName(user), role: user.role },
        subjects: mySubjects(user).map((s) => ({ id: s.id, name: subjectName(s), canEdit: isFaculty(user) && canEdit(user, s) })),
        quizzes,
        assignments,
        daily,
        today: today(),
      };

      if (isFaculty(user)) {
        // daily reminder: subjects that still have no practice questions today
        out.reminders = myEditable(user)
          .filter((s) => !db.dailyTasks.some((d) => same(d.subjectId, s.id) && d.date === today()))
          .map((s) => ({ subjectId: s.id, subjectName: subjectName(s) }));
      } else {
        // pending list, most urgent first
        const pending = [];
        for (const q of quizzes) if (!q.myResult) pending.push({ type: "Quiz", id: q.id, title: q.title, subjectName: q.subjectName, priority: PRIORITY.Quiz });
        for (const a of assignments)
          if (!a.mySubmission) pending.push({ type: a.kind, id: a.id, title: a.title, subjectName: a.subjectName, priority: PRIORITY[a.kind] || 3 });
        for (const d of daily)
          if (d.questions.some((q) => !q.answered)) pending.push({ type: "Daily", id: d.id, title: d.topic, subjectName: d.subjectName, priority: PRIORITY.Daily });
        pending.sort((x, y) => y.priority - x.priority);
        out.pending = pending;

        const mineQ = db.quizResults.filter((r) => same(r.studentId, user.id));
        const mineA = db.submissions.filter((s) => same(s.studentId, user.id));
        const score = [...mineQ, ...mineA].reduce((t, r) => t + r.score, 0);
        const total = [...mineQ, ...mineA].reduce((t, r) => t + r.total, 0);
        out.overall = { score: round2(score), total: round2(total), percent: pct(score, total) };
      }
      res.json(out);
    })
  );

  // ------------------------------ quizzes ------------------------------
  app.post(
    "/api/tasks/quizzes",
    auth,
    handle((req, res) => {
      needFaculty(req);
      const subject = subjectForEdit(req, req.body.subjectId);
      const title = clean(req.body.title, 120);
      if (!title) fail(400, "Quiz title is required.");
      const raw = Array.isArray(req.body.questions) ? req.body.questions : [];
      if (raw.length < 1 || raw.length > 50) fail(400, "A quiz needs between 1 and 50 questions.");
      const questions = raw.map((x, i) => {
        const text = clean(x.text, 500);
        const options = Array.isArray(x.options) ? x.options.map((o) => clean(o, 200)) : [];
        const correct = Number(x.correct);
        const marks = Number(x.marks);
        if (!text) fail(400, `Question ${i + 1}: text is required.`);
        if (options.length !== 4 || options.some((o) => !o)) fail(400, `Question ${i + 1}: all four options are required.`);
        if (!Number.isInteger(correct) || correct < 0 || correct > 3) fail(400, `Question ${i + 1}: choose the correct option (the key).`);
        if (!(marks >= 1 && marks <= 100)) fail(400, `Question ${i + 1}: marks must be between 1 and 100.`);
        return { text, options, correct, marks };
      });
      const quiz = {
        id: newId(db.quizzes),
        subjectId: subject.id,
        title,
        faculty: userName(req.user),
        facultyId: req.user.id,
        questions,
        createdAt: new Date().toISOString(),
      };
      db.quizzes.push(quiz);
      save();
      res.status(201).json(quizCard(quiz, req.user));
    })
  );

  // questions for taking the quiz: the answer key is never sent to students
  app.get(
    "/api/tasks/quizzes/:id",
    auth,
    handle((req, res) => {
      const quiz = db.quizzes.find((q) => q.id === Number(req.params.id));
      if (!quiz) fail(404, "Quiz not found.");
      subjectForView(req, quiz.subjectId);
      const faculty = isFaculty(req.user);
      if (!faculty && db.quizResults.some((r) => r.quizId === quiz.id && same(r.studentId, req.user.id)))
        fail(409, "You have already attempted this quiz.");
      res.json({
        id: quiz.id,
        title: quiz.title,
        subjectName: subjectName(subjectOf(quiz.subjectId)),
        totalMarks: quizTotal(quiz),
        questions: quiz.questions.map((q) => ({
          text: q.text,
          options: q.options,
          marks: q.marks,
          ...(faculty ? { correct: q.correct } : {}),
        })),
      });
    })
  );

  const buildReview = (quiz, answers) =>
    quiz.questions.map((q, i) => {
      const a = answers[i];
      const ok = a === q.correct;
      return {
        status: ok ? "correct" : a < 0 ? "skipped" : "wrong",
        marks: ok ? q.marks : 0,
        outOf: q.marks,
        text: q.text,
        yourAnswer: a,
        correct: q.correct,
        options: q.options,
      };
    });

  // scoring: the chosen option is matched with the faculty key
  app.post(
    "/api/tasks/quizzes/:id/submit",
    auth,
    handle((req, res) => {
      needStudent(req);
      const quiz = db.quizzes.find((q) => q.id === Number(req.params.id));
      if (!quiz) fail(404, "Quiz not found.");
      subjectForView(req, quiz.subjectId);
      if (db.quizResults.some((r) => r.quizId === quiz.id && same(r.studentId, req.user.id)))
        fail(409, "You have already attempted this quiz.");
      const given = Array.isArray(req.body.answers) ? req.body.answers : [];
      const answers = quiz.questions.map((_, i) => {
        const v = Number(given[i]);
        return Number.isInteger(v) && v >= 0 && v <= 3 ? v : -1;
      });
      const review = buildReview(quiz, answers);
      const score = review.reduce((t, r) => t + r.marks, 0);
      const total = quizTotal(quiz);
      db.quizResults.push({
        id: newId(db.quizResults),
        quizId: quiz.id,
        studentId: req.user.id,
        studentName: userName(req.user),
        score,
        total,
        answers,
        submittedAt: new Date().toISOString(),
      });
      save();
      res.json({ score, total, percent: pct(score, total), review });
    })
  );

  // review of an attempt that is already finished
  app.get(
    "/api/tasks/quizzes/:id/result",
    auth,
    handle((req, res) => {
      needStudent(req);
      const quiz = db.quizzes.find((q) => q.id === Number(req.params.id));
      if (!quiz) fail(404, "Quiz not found.");
      subjectForView(req, quiz.subjectId);
      const r = db.quizResults.find((x) => x.quizId === quiz.id && same(x.studentId, req.user.id));
      if (!r) fail(404, "You have not attempted this quiz yet.");
      res.json({ title: quiz.title, score: r.score, total: r.total, percent: pct(r.score, r.total), review: buildReview(quiz, r.answers) });
    })
  );

  // ------------------------------ assignments ------------------------------
  app.post(
    "/api/tasks/assignments",
    auth,
    handle((req, res) => {
      needFaculty(req);
      const subject = subjectForEdit(req, req.body.subjectId);
      const kind = req.body.kind === "End-Sem" ? "End-Sem" : req.body.kind === "Mid-Sem" ? "Mid-Sem" : null;
      const title = clean(req.body.title, 200);
      const maxMarks = Number(req.body.maxMarks);
      const keys = (Array.isArray(req.body.keys) ? req.body.keys : []).map((k) => clean(k, 120)).filter(Boolean);
      if (!kind) fail(400, "Choose Mid-Sem or End-Sem.");
      if (!title) fail(400, "Assignment title is required.");
      if (!(maxMarks >= 1 && maxMarks <= 1000)) fail(400, "Maximum marks must be between 1 and 1000.");
      if (keys.length < 1 || keys.length > 100) fail(400, "Add at least one answer key.");
      const a = {
        id: newId(db.assignments),
        subjectId: subject.id,
        title,
        kind,
        maxMarks,
        keys,
        faculty: userName(req.user),
        facultyId: req.user.id,
        createdAt: new Date().toISOString(),
      };
      db.assignments.push(a);
      save();
      res.status(201).json(assignmentCard(a, req.user));
    })
  );

  // same matching rule as checker.cpp, used only when the compiled checker is missing
  const jsCheck = (keys, text, maxMarks) => {
    const norm = (s) => s.toLowerCase().replace(/\s+/g, " ").trim();
    const body = norm(text);
    const missing = keys.filter((k) => !body.includes(norm(k)));
    const matched = keys.length - missing.length;
    return { matched, total: keys.length, score: round2((maxMarks * matched) / keys.length), max: maxMarks, missing };
  };

  const runChecker = (keys, text, maxMarks) =>
    new Promise((resolve) => {
      if (!fs.existsSync(CHECKER)) return resolve({ ...jsCheck(keys, text, maxMarks), engine: "js-fallback" });
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "chk-"));
      const keyFile = path.join(dir, "keys.txt");
      const ansFile = path.join(dir, "answer.txt");
      const cleanup = () => fs.rmSync(dir, { recursive: true, force: true });
      fs.writeFileSync(keyFile, keys.join("\n"));
      fs.writeFileSync(ansFile, text);
      execFile(CHECKER, [keyFile, ansFile, String(maxMarks)], { timeout: 10000 }, (err, stdout) => {
        cleanup();
        try {
          if (err) throw err;
          resolve({ ...JSON.parse(stdout), engine: "cpp" });
        } catch (e) {
          console.error("[tasks] C++ checker failed, using JS fallback:", e.message);
          resolve({ ...jsCheck(keys, text, maxMarks), engine: "js-fallback" });
        }
      });
    });

  app.post(
    "/api/tasks/assignments/:id/submit",
    auth,
    handle(async (req, res) => {
      needStudent(req);
      const a = db.assignments.find((x) => x.id === Number(req.params.id));
      if (!a) fail(404, "Assignment not found.");
      subjectForView(req, a.subjectId);
      if (db.submissions.some((s) => s.assignmentId === a.id && same(s.studentId, req.user.id))) fail(409, "You have already submitted this assignment.");
      const text = String(req.body.text ?? "");
      if (!text.trim()) fail(400, "The uploaded answer is empty.");
      const r = await runChecker(a.keys, text, a.maxMarks);
      const sub = {
        id: newId(db.submissions),
        assignmentId: a.id,
        studentId: req.user.id,
        studentName: userName(req.user),
        fileName: clean(req.body.fileName, 120) || "answer.txt",
        score: r.score,
        total: a.maxMarks,
        matched: r.matched,
        totalKeys: r.total,
        missing: r.missing,
        engine: r.engine,
        submittedAt: new Date().toISOString(),
      };
      db.submissions.push(sub);
      save();
      res.status(201).json(sub);
    })
  );

  // ------------------------------ daily practice ------------------------------
  app.post(
    "/api/tasks/daily",
    auth,
    handle((req, res) => {
      needFaculty(req);
      const subject = subjectForEdit(req, req.body.subjectId);
      const topic = clean(req.body.topic, 200);
      const questions = (Array.isArray(req.body.questions) ? req.body.questions : [])
        .map((q) => ({ text: clean(q.text, 500), model: clean(q.model, 1000) }))
        .filter((q) => q.text);
      if (!topic) fail(400, "Write what you taught today (the topic).");
      if (questions.length < 1 || questions.length > 30) fail(400, "Add between 1 and 30 practice questions.");
      const d = {
        id: newId(db.dailyTasks),
        subjectId: subject.id,
        topic,
        date: today(),
        questions,
        faculty: userName(req.user),
        facultyId: req.user.id,
        createdAt: new Date().toISOString(),
      };
      db.dailyTasks.push(d);
      save();
      res.status(201).json(dailyCard(d, req.user));
    })
  );

  app.post(
    "/api/tasks/daily/:id/answer",
    auth,
    handle((req, res) => {
      needStudent(req);
      const d = db.dailyTasks.find((x) => x.id === Number(req.params.id));
      if (!d) fail(404, "Daily task not found.");
      subjectForView(req, d.subjectId);
      const qIndex = Number(req.body.qIndex);
      const answer = clean(req.body.answer, 2000);
      if (!Number.isInteger(qIndex) || qIndex < 0 || qIndex >= d.questions.length) fail(400, "Unknown question.");
      if (!answer) fail(400, "Write your answer first.");
      if (db.dailyAnswers.some((x) => x.taskId === d.id && x.qIndex === qIndex && same(x.studentId, req.user.id)))
        fail(409, "You have already answered this question.");
      db.dailyAnswers.push({
        id: newId(db.dailyAnswers),
        taskId: d.id,
        qIndex,
        studentId: req.user.id,
        studentName: userName(req.user),
        answer,
        answeredAt: new Date().toISOString(),
      });
      save();
      res.status(201).json({ model: d.questions[qIndex].model });
    })
  );

  // ------------------------------ delete (faculty) ------------------------------
  const collections = { quizzes: "quizzes", assignments: "assignments", daily: "dailyTasks" };
  app.delete(
    "/api/tasks/:kind/:id",
    auth,
    handle((req, res) => {
      needFaculty(req);
      const name = collections[req.params.kind];
      if (!name) fail(404, "Unknown task type.");
      const item = db[name].find((x) => x.id === Number(req.params.id));
      if (!item) fail(404, "Task not found.");
      subjectForEdit(req, item.subjectId);
      db[name] = db[name].filter((x) => x.id !== item.id);
      if (name === "quizzes") db.quizResults = db.quizResults.filter((r) => r.quizId !== item.id);
      if (name === "assignments") db.submissions = db.submissions.filter((s) => s.assignmentId !== item.id);
      if (name === "dailyTasks") db.dailyAnswers = db.dailyAnswers.filter((x) => x.taskId !== item.id);
      save();
      res.json({ ok: true });
    })
  );

  // ------------------------------ faculty report ------------------------------
  app.get(
    "/api/tasks/report/:subjectId",
    auth,
    handle((req, res) => {
      needFaculty(req);
      const subject = subjectForEdit(req, req.params.subjectId);
      const quizzes = db.quizzes.filter((q) => same(q.subjectId, subject.id));
      const assignments = db.assignments.filter((a) => same(a.subjectId, subject.id));
      const dailies = db.dailyTasks.filter((d) => same(d.subjectId, subject.id));

      const students = new Map();
      const touch = (id, name) => {
        if (!students.has(String(id))) students.set(String(id), { studentId: id, name, quizScore: 0, quizTotal: 0, asgScore: 0, asgTotal: 0, quizzesDone: 0, assignmentsDone: 0, dailyAnswers: 0 });
        return students.get(String(id));
      };
      for (const e of db.enrollments || []) {
        if (!same(e.subjectId, subject.id)) continue;
        const u = (db.users || []).find((x) => same(x.id, e.studentId));
        touch(e.studentId, u ? userName(u) : `Student ${e.studentId}`);
      }
      for (const q of quizzes)
        for (const r of db.quizResults.filter((x) => x.quizId === q.id)) {
          const s = touch(r.studentId, r.studentName);
          s.quizScore += r.score;
          s.quizTotal += r.total;
          s.quizzesDone++;
        }
      for (const a of assignments)
        for (const r of db.submissions.filter((x) => x.assignmentId === a.id)) {
          const s = touch(r.studentId, r.studentName);
          s.asgScore += r.score;
          s.asgTotal += r.total;
          s.assignmentsDone++;
        }
      for (const d of dailies)
        for (const r of db.dailyAnswers.filter((x) => x.taskId === d.id)) touch(r.studentId, r.studentName).dailyAnswers++;

      const rows = [...students.values()].map((s) => ({
        studentId: s.studentId,
        name: s.name,
        quizzesDone: s.quizzesDone,
        assignmentsDone: s.assignmentsDone,
        dailyAnswers: s.dailyAnswers,
        quizPercent: pct(s.quizScore, s.quizTotal),
        assignmentPercent: pct(s.asgScore, s.asgTotal),
        overallPercent: pct(s.quizScore + s.asgScore, s.quizTotal + s.asgTotal),
      }));
      rows.sort((a, b) => b.overallPercent - a.overallPercent || a.name.localeCompare(b.name));

      res.json({
        subject: { id: subject.id, name: subjectName(subject) },
        leaderboard: rows,
        quizzes: quizzes.map((q) => {
          const rs = db.quizResults.filter((r) => r.quizId === q.id);
          return { id: q.id, title: q.title, attempts: rs.length, averagePercent: rs.length ? round2(rs.reduce((t, r) => t + pct(r.score, r.total), 0) / rs.length) : 0 };
        }),
        assignments: assignments.map((a) => ({
          id: a.id,
          title: a.title,
          kind: a.kind,
          maxMarks: a.maxMarks,
          submissions: db.submissions
            .filter((s) => s.assignmentId === a.id)
            .map((s) => ({ student: s.studentName, score: s.score, total: s.total, matched: s.matched, totalKeys: s.totalKeys, missing: s.missing, engine: s.engine })),
        })),
        dailyTasks: dailies.map((d) => ({ id: d.id, topic: d.topic, date: d.date, questionCount: d.questions.length, answers: db.dailyAnswers.filter((x) => x.taskId === d.id).length })),
      });
    })
  );

  console.log("Task tracking module mounted at /api/tasks (checker: " + (fs.existsSync(CHECKER) ? "C++" : "JS fallback, compile cpp/checker.cpp") + ")");
};

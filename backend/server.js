// backend/server.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const xlsx = require("xlsx");

const app = express();
const PORT = 4000;

// 본인 환경에 맞게 수정 가능
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/taekwondo_app";

app.use(cors());
app.use(bodyParser.json());

// ----- Mongo 연결 -----
mongoose
  .connect(MONGO_URI, { dbName: "taekwondo_app" })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("MongoDB error:", err));

// ----- 스키마 & 모델 -----
const studentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    level: String, // 초등/중등/고등/기타
    schoolName: String,
    gradeYear: String, // "3"
    gradeClass: String, // "2"
    phone: String, // 숫자 문자열
    birthDate: String, // "YYYY-MM-DD"
    belt: String, // 흰띠/노란띠/...
  },
  { timestamps: true }
);

const attendanceSchema = new mongoose.Schema(
  {
    date: { type: String, required: true }, // YYYY-MM-DD
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    status: { type: String, enum: ["출석", "결석"], required: true },
    arrivalTime: String, // "HH:MM"
  },
  { timestamps: true }
);

const Student = mongoose.model("Student", studentSchema);
const Attendance = mongoose.model("Attendance", attendanceSchema);

// ----- 수련생 API -----
// 목록
app.get("/api/students", async (req, res) => {
  try {
    const students = await Student.find().sort({ createdAt: 1 });
    res.json(students);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "학생 목록 조회 실패" });
  }
});

// 생성
app.post("/api/students", async (req, res) => {
  try {
    const student = new Student(req.body);
    await student.save();
    res.json(student);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "학생 생성 실패" });
  }
});

// 수정
app.patch("/api/students/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await Student.findByIdAndUpdate(id, req.body, {
      new: true,
    });
    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "학생 수정 실패" });
  }
});

// 🔥 삭제 (출석 기록도 같이 삭제)
app.delete("/api/students/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // 해당 수련생 출석 기록 모두 제거
    await Attendance.deleteMany({ studentId: id });

    // 수련생 삭제
    await Student.findByIdAndDelete(id);

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "학생 삭제 실패" });
  }
});

// ----- 출석 API -----
// 특정 날짜 출석 조회
app.get("/api/attendance", async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ error: "date 쿼리가 필요합니다." });
    }

    const records = await Attendance.find({ date });
    res.json(records);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "출석 조회 실패" });
  }
});

// 출석 저장 (한 날짜 전체 갈아끼우기)
app.post("/api/attendance/save", async (req, res) => {
  try {
    const { date, records } = req.body;
    if (!date || !Array.isArray(records)) {
      return res.status(400).json({ error: "date / records 필요" });
    }

    // 해당 날짜 전체 삭제 후 다시 저장
    await Attendance.deleteMany({ date });

    const docs = records
      .filter((r) => r.studentId && r.status)
      .map((r) => ({
        date,
        studentId: r.studentId,
        status: r.status,
        arrivalTime: r.arrivalTime || "",
      }));

    if (docs.length > 0) {
      await Attendance.insertMany(docs);
    }

    res.json({ ok: true, count: docs.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "출석 저장 실패" });
  }
});

// 엑셀로 내보내기 (이름 + 입실 시간)
app.get("/api/attendance/export", async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ error: "date 쿼리가 필요합니다." });
    }

    const records = await Attendance.find({ date }).populate("studentId");

    const rows = [
      ["이름", "입실 시간", "상태"], // 헤더
      ...records.map((r) => [
        r.studentId ? r.studentId.name : "",
        r.arrivalTime || "",
        r.status,
      ]),
    ];

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.aoa_to_sheet(rows);
    xlsx.utils.book_append_sheet(wb, ws, "출석");

    const buffer = xlsx.write(wb, {
      type: "buffer",
      bookType: "xlsx",
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="attendance-${date}.xlsx"`
    );
    res.send(buffer);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "엑셀 내보내기 실패" });
  }
});

// ----- 서버 시작 -----
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});

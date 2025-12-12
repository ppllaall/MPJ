import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  FlatList,
  Linking,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import DateTimePicker from "@react-native-community/datetimepicker";

const API_BASE = "http://172.30.1.12:4000"; // ← 네 서버 IP/포트

type Student = {
  _id: string;
  name: string;
  level?: string;
  schoolName?: string;
  gradeYear?: string;
  gradeClass?: string;
  phone?: string;
  birthDate?: string;
  belt?: string;
};

type AttendanceStatus = "출석" | "결석";

type AttendanceMap = {
  [studentId: string]: {
    status: AttendanceStatus;
    arrivalTime?: string;
  };
};

type TabKey = "dashboard" | "students" | "attendance";

const beltColors: Record<string, string> = {
  흰띠: "#e5e7eb",
  노란띠: "#fde68a",
  초록띠: "#bbf7d0",
  파란띠: "#bfdbfe",
  빨간띠: "#fecaca",
  검은띠: "#111827",
  미지정: "#e5e7eb",
};

const LEVEL_OPTIONS = ["초등", "중등", "고등", "기타"];
const BELT_OPTIONS = ["흰띠", "노란띠", "초록띠", "파란띠", "빨간띠", "검은띠"];

function formatDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatTime(d: Date) {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function sameMonthDay(dateStr: string | undefined, base: Date) {
  if (!dateStr) return false;
  const cleaned = dateStr.length > 10 ? dateStr.slice(0, 10) : dateStr;
  const parts = cleaned.split("-");
  if (parts.length < 3) return false;
  const [, mm, dd] = parts;
  const bm = String(base.getMonth() + 1).padStart(2, "0");
  const bd = String(base.getDate()).padStart(2, "0");
  return mm === bm && dd === bd;
}

function addDays(d: Date, diff: number) {
  const nd = new Date(d.getTime());
  nd.setDate(nd.getDate() + diff);
  return nd;
}

function parseDateString(dateStr?: string): Date {
  if (!dateStr) return new Date();
  const cleaned = dateStr.length > 10 ? dateStr.slice(0, 10) : dateStr;
  const parts = cleaned.split("-");
  if (parts.length !== 3) return new Date();
  const [y, m, d] = parts.map((p) => Number(p));
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

export default function ManagementScreen() {
  const [tab, setTab] = useState<TabKey>("dashboard");

  const [students, setStudents] = useState<Student[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [attendanceMap, setAttendanceMap] = useState<AttendanceMap>({});
  const [loading, setLoading] = useState(false);

  const [showDatePicker, setShowDatePicker] = useState(false);

  const [showBirthPicker, setShowBirthPicker] = useState(false);
  const [birthPickerDate, setBirthPickerDate] = useState<Date>(new Date());

  const emptyForm: Partial<Student> = {
    name: "",
    level: "",
    schoolName: "",
    gradeYear: "",
    gradeClass: "",
    phone: "",
    birthDate: "",
    belt: "",
  };
  const [studentForm, setStudentForm] = useState<Partial<Student>>(emptyForm);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [studentModalVisible, setStudentModalVisible] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");

  const [beltModalBelt, setBeltModalBelt] = useState<string | null>(null);

  const [statusModalType, setStatusModalType] = useState<
    "present" | "absent" | "unchecked" | null
  >(null);

  // 초기 로딩
  useEffect(() => {
    (async () => {
      await loadStudents();
    })();
  }, []);

  useEffect(() => {
    (async () => {
      await loadAttendanceForDate(selectedDate);
    })();
  }, [selectedDate]);

  const loadStudents = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/students`);
      const json = await res.json();
      setStudents(json || []);
    } catch (e) {
      console.error(e);
      Alert.alert("오류", "수련생 목록을 불러오지 못했습니다.");
    }
  };

  const loadAttendanceForDate = async (date: Date) => {
    try {
      setLoading(true);
      const dateStr = formatDate(date);
      const res = await fetch(
        `${API_BASE}/api/attendance?date=${encodeURIComponent(dateStr)}`
      );
      const json = await res.json();
      const map: AttendanceMap = {};
      if (Array.isArray(json)) {
        json.forEach((rec: any) => {
          map[rec.studentId] = {
            status: rec.status as AttendanceStatus,
            arrivalTime: rec.arrivalTime || undefined,
          };
        });
      }
      setAttendanceMap(map);
    } catch (e) {
      console.error(e);
      Alert.alert("오류", "출석 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 대시보드 통계
  const stats = useMemo(() => {
    const total = students.length;
    const values = Object.values(attendanceMap);
    const presentCount = values.filter((v) => v.status === "출석").length;
    const absentCount = values.filter((v) => v.status === "결석").length;
    const checkedCount = values.length;
    const uncheckedCount = Math.max(0, total - checkedCount);
    const rate =
      total === 0 ? null : Math.round((presentCount / total) * 100);

    const beltStat: Record<string, number> = {};
    students.forEach((s) => {
      const b = s.belt || "미지정";
      beltStat[b] = (beltStat[b] || 0) + 1;
    });

    const todayBase = new Date();
    const todayBirth = students.filter((s) =>
      sameMonthDay(s.birthDate, todayBase)
    );
    const tomorrowBirth = students.filter((s) =>
      sameMonthDay(s.birthDate, addDays(todayBase, 1))
    );

    return {
      total,
      presentCount,
      absentCount,
      uncheckedCount,
      rate,
      beltStat,
      todayBirth,
      tomorrowBirth,
    };
  }, [students, attendanceMap]);

  // 출석/결석/미체크 모달용 데이터
  const statusModalData = useMemo(() => {
    if (!statusModalType) return null;

    let title = "";
    let list: Student[] = [];

    if (statusModalType === "present") {
      title = "출석 인원";
      list = students.filter(
        (s) => attendanceMap[s._id]?.status === "출석"
      );
    } else if (statusModalType === "absent") {
      title = "결석 인원";
      list = students.filter(
        (s) => attendanceMap[s._id]?.status === "결석"
      );
    } else {
      title = "미체크 인원";
      list = students.filter((s) => !attendanceMap[s._id]);
    }

    return { title, list };
  }, [statusModalType, students, attendanceMap]);

  // 출석 저장 & 엑셀
  const handleSaveAttendance = async () => {
    try {
      const dateStr = formatDate(selectedDate);
      const records = Object.entries(attendanceMap).map(
        ([studentId, v]) => ({
          studentId,
          status: v.status,
          arrivalTime: v.arrivalTime || "",
        })
      );

      setLoading(true);
      const res = await fetch(`${API_BASE}/api/attendance/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: dateStr, records }),
      });

      if (!res.ok) {
        throw new Error("save failed");
      }

      Alert.alert("완료", "출석 정보가 저장되었습니다.");
      await loadAttendanceForDate(selectedDate);
    } catch (e) {
      console.error(e);
      Alert.alert("오류", "출석 저장 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    const dateStr = formatDate(selectedDate);
    const url = `${API_BASE}/api/attendance/export?date=${encodeURIComponent(
      dateStr
    )}`;
    Linking.openURL(url);
  };

  const handleMarkUncheckedAsAbsent = () => {
    setAttendanceMap((prev) => {
      const next: AttendanceMap = { ...prev };
      students.forEach((s) => {
        if (!next[s._id]) {
          next[s._id] = { status: "결석" };
        }
      });
      return next;
    });
  };

  // 수련생 모달 열기/닫기
  const openNewStudentModal = () => {
    setEditingStudentId(null);
    setStudentForm(emptyForm);
    setBirthPickerDate(new Date());
    setStudentModalVisible(true);
  };

  const openEditStudentModal = (s: Student) => {
    setEditingStudentId(s._id);
    setStudentForm({ ...s });
    setBirthPickerDate(parseDateString(s.birthDate));
    setStudentModalVisible(true);
  };

  const handleSaveStudent = async () => {
    if (!studentForm.name) {
      Alert.alert("경고", "이름은 필수입니다.");
      return;
    }

    const payload = {
      name: studentForm.name,
      level: studentForm.level,
      schoolName: studentForm.schoolName,
      gradeYear: studentForm.gradeYear,
      gradeClass: studentForm.gradeClass,
      phone: studentForm.phone,
      birthDate: studentForm.birthDate,
      belt: studentForm.belt,
    };

    try {
      setLoading(true);
      if (editingStudentId) {
        const res = await fetch(
          `${API_BASE}/api/students/${editingStudentId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );
        if (!res.ok) throw new Error("update failed");
      } else {
        const res = await fetch(`${API_BASE}/api/students`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("create failed");
      }

      setStudentModalVisible(false);
      setEditingStudentId(null);
      await loadStudents();
      await loadAttendanceForDate(selectedDate);
    } catch (e) {
      console.error(e);
      Alert.alert("오류", "수련생 저장 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 🔥 수련생 삭제
  const handleDeleteStudent = () => {
    if (!editingStudentId) return;

    Alert.alert(
      "삭제 확인",
      "이 수련생을 삭제하시겠습니까?\n해당 수련생의 출석 기록도 함께 삭제됩니다.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "삭제",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);
              const res = await fetch(
                `${API_BASE}/api/students/${editingStudentId}`,
                { method: "DELETE" }
              );
              if (!res.ok) throw new Error("delete failed");

              setStudentModalVisible(false);
              setEditingStudentId(null);
              await loadStudents();
              await loadAttendanceForDate(selectedDate);
            } catch (e) {
              console.error(e);
              Alert.alert("오류", "수련생 삭제 중 문제가 발생했습니다.");
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const filteredStudents = useMemo(() => {
    const keyword = studentSearch.trim();
    if (!keyword) return students;
    return students.filter((s) =>
      s.name?.toLowerCase().includes(keyword.toLowerCase())
    );
  }, [students, studentSearch]);

  // 출석 탭 정렬/그룹화
  const sortedStudentsForAttendance = useMemo(() => {
    const levelOrder: Record<string, number> = {
      초등: 0,
      중등: 1,
      고등: 2,
    };
    return [...students].sort((a, b) => {
      const la = a.level || "기타";
      const lb = b.level || "기타";
      const oa = levelOrder[la] ?? 3;
      const ob = levelOrder[lb] ?? 3;
      if (oa !== ob) return oa - ob;

      const ya = Number(a.gradeYear || 0);
      const yb = Number(b.gradeYear || 0);
      if (ya !== yb) return ya - yb;

      const ca = Number(a.gradeClass || 0);
      const cb = Number(b.gradeClass || 0);
      if (ca !== cb) return ca - cb;

      return (a.name || "").localeCompare(b.name || "");
    });
  }, [students]);

  const groupedStudentsForAttendance = useMemo(() => {
    const groups: { [label: string]: Student[] } = {};

    const makeLabel = (s: Student) => {
      const level = s.level || "기타";
      const year = s.gradeYear ? `${s.gradeYear}학년` : "";
      const klass = s.gradeClass ? `${s.gradeClass}반` : "";
      let base =
        level === "기타"
          ? "기타"
          : `${level}${year ? " " + year : ""}`;
      if (klass) base += " " + klass;
      return base;
    };

    sortedStudentsForAttendance.forEach((s) => {
      const label = makeLabel(s);
      if (!groups[label]) groups[label] = [];
      groups[label].push(s);
    });

    return Object.entries(groups).map(([label, list]) => ({
      label,
      students: list,
    }));
  }, [sortedStudentsForAttendance]);

  // 렌더
  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={["#22c55e", "#3b82f6"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>관리 App</Text>
        <View style={styles.tabRow}>
          <TopTabButton
            label="대시보드"
            active={tab === "dashboard"}
            onPress={() => setTab("dashboard")}
          />
          <TopTabButton
            label="수련생"
            active={tab === "students"}
            onPress={() => setTab("students")}
          />
          <TopTabButton
            label="출석"
            active={tab === "attendance"}
            onPress={() => setTab("attendance")}
          />
        </View>
      </LinearGradient>

      <View style={styles.body}>
        {/* 대시보드 */}
        {tab === "dashboard" && (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>오늘 도장 현황</Text>
              <View style={styles.metricRow}>
                <MetricBox
                  title="날짜"
                  value={formatDate(selectedDate)}
                  color="#3b82f6"
                />
                <MetricBox
                  title="총 수련생"
                  value={`${stats.total}명`}
                  color="#22c55e"
                />
              </View>
              <View style={styles.metricRow}>
                <MetricBox
                  title="출석 인원"
                  value={`${stats.presentCount}명`}
                  color="#6366f1"
                  onPress={() => setStatusModalType("present")}
                />
                <MetricBox
                  title="결석 인원"
                  value={`${stats.absentCount}명`}
                  color="#f97316"
                  onPress={() => setStatusModalType("absent")}
                />
              </View>
              <View style={styles.metricRow}>
                <MetricBox
                  title="미체크 인원"
                  value={`${stats.uncheckedCount}명`}
                  color="#6b7280"
                  onPress={() => setStatusModalType("unchecked")}
                />
                <MetricBox
                  title="출석률"
                  value={
                    stats.rate === null ? "데이터 없음" : `${stats.rate}%`
                  }
                  color="#ec4899"
                />
              </View>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>띠별 인원</Text>
              <View style={styles.beltRow}>
                {Object.entries(stats.beltStat).map(([belt, count]) => (
                  <TouchableOpacity
                    key={belt}
                    style={[
                      styles.beltChip,
                      {
                        backgroundColor:
                          belt === "검은띠"
                            ? "#111827"
                            : beltColors[belt] || "#e5e7eb",
                      },
                    ]}
                    onPress={() => setBeltModalBelt(belt)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.beltText,
                        belt === "검은띠" && { color: "white" },
                      ]}
                    >
                      {belt} {count}명
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.helperText}>
                띠 카드를 누르면 해당 띠 수련생 목록이 표시됩니다.
              </Text>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>생일 수련생</Text>
              <Text style={styles.subHeading}>오늘 생일</Text>
              {stats.todayBirth.length === 0 ? (
                <Text style={styles.helperText}>
                  오늘 생일인 수련생이 없습니다.
                </Text>
              ) : (
                stats.todayBirth.map((s) => (
                  <Text key={s._id} style={styles.normalText}>
                    🎂 {s.name}
                  </Text>
                ))
              )}

              <Text style={[styles.subHeading, { marginTop: 12 }]}>
                내일 생일
              </Text>
              {stats.tomorrowBirth.length === 0 ? (
                <Text style={styles.helperText}>
                  내일 생일인 수련생이 없습니다.
                </Text>
              ) : (
                stats.tomorrowBirth.map((s) => (
                  <Text key={s._id} style={styles.normalText}>
                    🎉 {s.name}
                  </Text>
                ))
              )}
            </View>
          </ScrollView>
        )}

        {/* 수련생 탭 */}
        {tab === "students" && (
          <View style={{ flex: 1 }}>
            <View style={styles.sectionCard}>
              <View style={styles.rowBetween}>
                <Text style={styles.sectionTitle}>수련생 목록</Text>
                <TouchableOpacity
                  style={styles.primaryTinyButton}
                  onPress={openNewStudentModal}
                >
                  <Text style={styles.primaryTinyText}>+ 등록</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                value={studentSearch}
                onChangeText={setStudentSearch}
                placeholder="이름 검색"
                style={styles.searchInput}
              />

              <FlatList
                data={filteredStudents}
                keyExtractor={(item) => item._id}
                contentContainerStyle={{ paddingTop: 8, paddingBottom: 16 }}
                renderItem={({ item }) => {
                  const belt = item.belt || "미지정";
                  const beltColor = beltColors[belt] || "#e5e7eb";
                  const gradeLabel =
                    item.level && item.gradeYear
                      ? `${item.level} ${item.gradeYear}학년${
                          item.gradeClass ? ` ${item.gradeClass}반` : ""
                        }`
                      : "-";
                  return (
                    <TouchableOpacity
                      style={styles.studentRow}
                      onPress={() => openEditStudentModal(item)}
                    >
                      <View>
                        <Text style={styles.studentName}>{item.name}</Text>
                        <Text style={styles.studentSub}>{gradeLabel}</Text>
                      </View>
                      <View
                        style={[
                          styles.beltBadge,
                          { backgroundColor: beltColor },
                        ]}
                      >
                        <Text
                          style={[
                            styles.beltBadgeText,
                            belt === "검은띠" && { color: "white" },
                          ]}
                        >
                          {belt}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            </View>

            {/* 수련생 등록/수정 모달 */}
            {studentModalVisible && (
              <View style={styles.modalOverlay}>
                <View style={styles.modalCard}>
                  <Text style={styles.modalTitle}>
                    {editingStudentId ? "수련생 정보 수정" : "수련생 등록"}
                  </Text>

                  <ScrollView
                    contentContainerStyle={{ paddingBottom: 16 }}
                    keyboardShouldPersistTaps="handled"
                  >
                    <LabeledInput
                      label="이름"
                      value={studentForm.name || ""}
                      onChangeText={(v) =>
                        setStudentForm((f) => ({ ...f, name: v }))
                      }
                    />

                    {/* 학년 구분 선택 */}
                    <Text style={styles.inputLabel}>학년 구분</Text>
                    <View style={styles.chipRow}>
                      {LEVEL_OPTIONS.map((opt) => {
                        const active = studentForm.level === opt;
                        return (
                          <TouchableOpacity
                            key={opt}
                            style={[
                              styles.selectChip,
                              active && styles.selectChipActive,
                            ]}
                            onPress={() =>
                              setStudentForm((f) => ({ ...f, level: opt }))
                            }
                          >
                            <Text
                              style={[
                                styles.selectChipText,
                                active && styles.selectChipTextActive,
                              ]}
                            >
                              {opt}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <LabeledInput
                      label="학교 이름"
                      value={studentForm.schoolName || ""}
                      onChangeText={(v) =>
                        setStudentForm((f) => ({ ...f, schoolName: v }))
                      }
                    />
                    <LabeledInput
                      label="학년"
                      value={studentForm.gradeYear || ""}
                      keyboardType="number-pad"
                      onChangeText={(v) =>
                        setStudentForm((f) => ({ ...f, gradeYear: v }))
                      }
                    />
                    <LabeledInput
                      label="반 (숫자만 입력)"
                      value={studentForm.gradeClass || ""}
                      keyboardType="number-pad"
                      onChangeText={(v) =>
                        setStudentForm((f) => ({ ...f, gradeClass: v }))
                      }
                    />
                    <LabeledInput
                      label="연락처 (숫자만)"
                      value={studentForm.phone || ""}
                      keyboardType="number-pad"
                      onChangeText={(v) =>
                        setStudentForm((f) => ({
                          ...f,
                          phone: v.replace(/[^0-9]/g, ""),
                        }))
                      }
                    />

                    {/* 생년월일 – DatePicker 버튼 */}
                    <Text style={styles.inputLabel}>생년월일</Text>
                    <TouchableOpacity
                      style={styles.dateBadgeSmall}
                      onPress={() => setShowBirthPicker(true)}
                    >
                      <Text style={styles.dateBadgeText}>
                        {studentForm.birthDate || "선택"}
                      </Text>
                      <Text style={styles.dateBadgeSub}>눌러서 변경</Text>
                    </TouchableOpacity>

                    {/* 띠 선택 – 띠 색상으로 */}
                    <Text style={[styles.inputLabel, { marginTop: 10 }]}>
                      띠 선택
                    </Text>
                    <View style={styles.chipRow}>
                      {BELT_OPTIONS.map((opt) => {
                        const active = studentForm.belt === opt;
                        const color = beltColors[opt] || "#d1d5db";
                        const isBlack = opt === "검은띠";
                        return (
                          <TouchableOpacity
                            key={opt}
                            style={[
                              styles.beltSelectChip,
                              { borderColor: color },
                              active && { backgroundColor: color },
                            ]}
                            onPress={() =>
                              setStudentForm((f) => ({ ...f, belt: opt }))
                            }
                          >
                            <Text
                              style={[
                                styles.beltSelectText,
                                active &&
                                  (isBlack
                                    ? { color: "white" }
                                    : { color: "#111827" }),
                              ]}
                            >
                              {opt}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>

                  <View style={styles.modalButtonRow}>
                    {editingStudentId && (
                      <TouchableOpacity
                        style={[styles.modalButton, styles.modalDelete]}
                        onPress={handleDeleteStudent}
                      >
                        <Text style={styles.modalDeleteText}>삭제</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[styles.modalButton, styles.modalCancel]}
                      onPress={() => {
                        setStudentModalVisible(false);
                        setEditingStudentId(null);
                      }}
                    >
                      <Text style={styles.modalCancelText}>닫기</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.modalSave]}
                      onPress={handleSaveStudent}
                    >
                      <Text style={styles.modalSaveText}>저장</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

        {/* 출석 탭 */}
        {tab === "attendance" && (
          <View style={{ flex: 1 }}>
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>출석 체크</Text>

                <TouchableOpacity
                  style={styles.dateBadge}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={styles.dateBadgeText}>
                    {formatDate(selectedDate)}
                  </Text>
                  <Text style={styles.dateBadgeSub}>날짜 변경</Text>
                </TouchableOpacity>

                <View style={{ height: 8 }} />

                <TouchableOpacity
                  style={styles.outlineButton}
                  onPress={handleMarkUncheckedAsAbsent}
                >
                  <Text style={styles.outlineButtonText}>
                    미체크 인원 전부 결석 처리
                  </Text>
                </TouchableOpacity>

                <View style={{ height: 8 }} />

                <TouchableOpacity
                  style={styles.outlineButton}
                  onPress={handleExportExcel}
                >
                  <Text style={styles.outlineButtonText}>
                    오늘 출석 엑셀로 내보내기
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>수련생별 출석 상태</Text>

              {groupedStudentsForAttendance.map((group) => (
                <View key={group.label} style={styles.groupCard}>
                  <Text style={styles.groupHeader}>{group.label}</Text>
                  {group.students.map((item) => {
                    const rec = attendanceMap[item._id];
                    const status = rec ? rec.status : "미체크";
                    const timeLabel =
                      rec && rec.status === "출석" && rec.arrivalTime
                        ? `(${rec.arrivalTime})`
                        : "";

                    const belt = item.belt || "미지정";
                    const beltColor = beltColors[belt] || "#e5e7eb";

                    const onPresent = () => {
                      const now = new Date();
                      setAttendanceMap((prev) => ({
                        ...prev,
                        [item._id]: {
                          status: "출석",
                          arrivalTime: formatTime(now),
                        },
                      }));
                    };

                    const onAbsent = () => {
                      setAttendanceMap((prev) => ({
                        ...prev,
                        [item._id]: {
                          status: "결석",
                          arrivalTime: "",
                        },
                      }));
                    };

                    return (
                      <View key={item._id} style={styles.attRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.studentName}>{item.name}</Text>
                          <Text style={styles.studentSub}>
                            {status}
                            {timeLabel && ` ${timeLabel}`}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.beltBadgeSmall,
                            { backgroundColor: beltColor },
                          ]}
                        >
                          <Text
                            style={[
                              styles.beltBadgeText,
                              belt === "검은띠" && { color: "white" },
                            ]}
                          >
                            {belt}
                          </Text>
                        </View>
                        <View style={styles.attButtonGroup}>
                          <TouchableOpacity
                            style={[
                              styles.attButton,
                              status === "출석" && styles.attButtonActive,
                            ]}
                            onPress={onPresent}
                          >
                            <Text
                              style={[
                                styles.attButtonText,
                                status === "출석" &&
                                  styles.attButtonTextActive,
                              ]}
                            >
                              출석
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.attButton,
                              status === "결석" && styles.attButtonActiveRed,
                            ]}
                            onPress={onAbsent}
                          >
                            <Text
                              style={[
                                styles.attButtonText,
                                status === "결석" &&
                                  styles.attButtonTextActive,
                              ]}
                            >
                              결석
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>

            <View style={styles.footerBar}>
              <TouchableOpacity
                style={styles.footerButton}
                onPress={handleSaveAttendance}
              >
                <Text style={styles.footerButtonText}>
                  {loading ? "저장 중..." : "출석 저장"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* 출석 날짜 DatePicker */}
      {showDatePicker && (
        <DateTimePicker
          mode="date"
          value={selectedDate}
          onChange={(_e, d) => {
            setShowDatePicker(false);
            if (d) setSelectedDate(d);
          }}
        />
      )}

      {/* 생년월일 DatePicker */}
      {showBirthPicker && (
        <DateTimePicker
          mode="date"
          value={birthPickerDate}
          onChange={(_e, d) => {
            setShowBirthPicker(false);
            if (d) {
              setBirthPickerDate(d);
              setStudentForm((f) => ({
                ...f,
                birthDate: formatDate(d),
              }));
            }
          }}
        />
      )}

      {/* 띠별 인원 모달 */}
      {beltModalBelt && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{beltModalBelt} 수련생</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {students
                .filter(
                  (s) => (s.belt || "미지정") === beltModalBelt
                )
                .map((s) => (
                  <Text key={s._id} style={styles.normalText}>
                    • {s.name}
                  </Text>
                ))}
            </ScrollView>
            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancel]}
                onPress={() => setBeltModalBelt(null)}
              >
                <Text style={styles.modalCancelText}>닫기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* 출석/결석/미체크 모달 */}
      {statusModalType && statusModalData && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{statusModalData.title}</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {statusModalData.list.length === 0 ? (
                <Text style={styles.helperText}>
                  해당 인원이 없습니다.
                </Text>
              ) : (
                statusModalData.list.map((s) => (
                  <Text key={s._id} style={styles.normalText}>
                    • {s.name}
                  </Text>
                ))
              )}
            </ScrollView>
            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancel]}
                onPress={() => setStatusModalType(null)}
              >
                <Text style={styles.modalCancelText}>닫기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

// 공통 컴포넌트/스타일
function TopTabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.topTabButton, active && styles.topTabButtonActive]}
      onPress={onPress}
    >
      <Text
        style={[styles.topTabText, active && styles.topTabTextActive]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function MetricBox({
  title,
  value,
  color,
  onPress,
}: {
  title: string;
  value: string;
  color: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.8 : 1}
      disabled={!onPress}
      onPress={onPress}
      style={[styles.metricBox, { borderColor: color }]}
    >
      <Text style={styles.metricTitle}>{title}</Text>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
    </TouchableOpacity>
  );
}

function LabeledInput(props: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: "default" | "number-pad";
}) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={styles.inputLabel}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        keyboardType={props.keyboardType || "default"}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#e5e7eb",
  },
  header: {
    paddingTop: 48,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "white",
    marginBottom: 16,
  },
  tabRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 999,
    padding: 4,
  },
  topTabButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  topTabButtonActive: {
    backgroundColor: "white",
  },
  topTabText: {
    color: "rgba(255,255,255,0.8)",
    fontWeight: "600",
    fontSize: 14,
  },
  topTabTextActive: {
    color: "#2563eb",
  },
  body: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  sectionCard: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
    color: "#111827",
  },
  metricRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  metricBox: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  metricTitle: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: "700",
  },
  beltRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  beltChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  beltText: {
    fontSize: 13,
    color: "#111827",
    fontWeight: "600",
  },
  helperText: {
    marginTop: 8,
    fontSize: 12,
    color: "#6b7280",
  },
  subHeading: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 4,
    marginBottom: 4,
    color: "#111827",
  },
  normalText: {
    fontSize: 13,
    color: "#374151",
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  primaryTinyButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#2563eb",
  },
  primaryTinyText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  searchInput: {
    marginTop: 8,
    borderRadius: 999,
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
  },
  studentRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  studentName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  studentSub: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  beltBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  beltBadgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    marginRight: 6,
  },
  beltBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#111827",
  },
  modalOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  modalCard: {
    width: "100%",
    maxHeight: "85%",
    backgroundColor: "white",
    borderRadius: 20,
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 4,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  selectChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "white",
  },
  selectChipActive: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  selectChipText: {
    fontSize: 12,
    color: "#374151",
    fontWeight: "600",
  },
  selectChipTextActive: {
    color: "white",
  },
  beltSelectChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: "white",
  },
  beltSelectText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
  },
  modalButtonRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 12,
    gap: 8,
    flexWrap: "wrap",
  },
  modalButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  modalCancel: {
    backgroundColor: "#e5e7eb",
  },
  modalSave: {
    backgroundColor: "#2563eb",
  },
  modalCancelText: {
    fontSize: 13,
    color: "#111827",
  },
  modalSaveText: {
    fontSize: 13,
    color: "white",
    fontWeight: "600",
  },
  modalDelete: {
    backgroundColor: "#fee2e2",
  },
  modalDeleteText: {
    fontSize: 13,
    color: "#b91c1c",
    fontWeight: "600",
  },
  dateBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#3b82f6",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  dateBadgeSmall: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#3b82f6",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dateBadgeText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1d4ed8",
  },
  dateBadgeSub: {
    fontSize: 11,
    color: "#6b7280",
  },
  outlineButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#9ca3af",
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  outlineButtonText: {
    fontSize: 13,
    color: "#374151",
    fontWeight: "600",
  },
  attRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  attButtonGroup: {
    flexDirection: "row",
    gap: 4,
  },
  attButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center",
  },
  attButtonActive: {
    backgroundColor: "#22c55e",
    borderColor: "#22c55e",
  },
  attButtonActiveRed: {
    backgroundColor: "#f97316",
    borderColor: "#f97316",
  },
  attButtonText: {
    fontSize: 12,
    color: "#374151",
    fontWeight: "600",
  },
  attButtonTextActive: {
    color: "white",
  },
  footerBar: {
    padding: 10,
    backgroundColor: "white",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e5e7eb",
  },
  footerButton: {
    borderRadius: 999,
    backgroundColor: "#2563eb",
    paddingVertical: 10,
    alignItems: "center",
  },
  footerButtonText: {
    color: "white",
    fontWeight: "700",
  },
  groupCard: {
    backgroundColor: "#f9fafb",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  groupHeader: {
    fontSize: 13,
    fontWeight: "700",
    color: "#4b5563",
    marginBottom: 4,
  },
});

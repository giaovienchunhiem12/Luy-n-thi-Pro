import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import {
  ChevronLeft,
  FileSpreadsheet,
  BarChart2,
  Search,
  CheckCircle2,
  X,
  Award,
  Users,
  Copy,
  ExternalLink,
  ShieldAlert,
  AlertTriangle
} from 'lucide-react';
import { ExamSession } from './OnlineAssignment';

export interface StudentResultItem {
  id?: string;
  sessionId?: string;
  examTitle?: string;
  stt?: number;
  sbd: string;
  studentName: string;
  totalScore: number;
  p1: string;
  p2: string;
  p3: string;
  p4: string;
  startedAtStr: string;
  submittedAtStr: string;
  status: string;
  violationLogs?: { time: string; type: string; details: string }[];
  tabSwitchCount?: number;
}

interface ExamResultsViewProps {
  session: ExamSession;
  onBack: () => void;
}

export default function ExamResultsView({ session, onBack }: ExamResultsViewProps) {
  const [results, setResults] = useState<StudentResultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchName, setSearchName] = useState('');
  const [sortBy, setSortBy] = useState<'time' | 'score_desc' | 'score_asc' | 'name'>('time');
  const [filterStatus, setFilterStatus] = useState<'all' | 'Đúng giờ' | 'Nộp muộn'>('all');
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedStudentForViolation, setSelectedStudentForViolation] = useState<StudentResultItem | null>(null);

  // Lắng nghe dữ liệu nộp bài THỰC TẾ từ học sinh qua đường link đề thi (bỏ dữ liệu mặc định)
  useEffect(() => {
    setLoading(true);

    const q = query(collection(db, 'examSubmissions'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const liveList: StudentResultItem[] = snapshot.docs
          .map((d, index) => {
            const data = d.data();
            return {
              id: d.id,
              sessionId: data.sessionId,
              examTitle: data.examTitle,
              sbd: data.sbd || String(index + 1).padStart(2, '0'),
              studentName: data.studentName || 'Học sinh',
              totalScore: typeof data.totalScore === 'number' ? data.totalScore : data.score || 0,
              p1: data.p1 || `${data.scoreBreakdown?.part1 || 0}`,
              p2: data.p2 || `${data.scoreBreakdown?.part2 || 0}`,
              p3: data.p3 || `${data.scoreBreakdown?.part3 || 0}`,
              p4: data.p4 || '0',
              startedAtStr: data.startedAtStr || 'Vừa xong',
              submittedAtStr: data.submittedAtStr || 'Vừa xong',
              status: data.status || 'Đúng giờ',
              violationLogs: data.violationLogs || [],
              tabSwitchCount: data.tabSwitchCount || 0
            };
          })
          // Lọc chính xác các bài nộp thuộc về phiên giao đề này hoặc liên kết với đề thi này
          .filter((item) =>
            item.sessionId === session.id ||
            (session.examId && item.sessionId === session.examId) ||
            item.examTitle === session.examTitle
          );

        setResults(liveList);
        setLoading(false);
      },
      (error) => {
        console.warn('Lỗi đọc Firestore examSubmissions:', error);
        setResults([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [session.id, session.examId, session.examTitle]);

  // Bộ lọc & Sắp xếp dữ liệu bài làm thực tế
  const filteredResults = results
    .filter((item) => {
      const matchName = item.studentName.toLowerCase().includes(searchName.toLowerCase());
      const matchStatus = filterStatus === 'all' || item.status === filterStatus;
      return matchName && matchStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'score_desc') return b.totalScore - a.totalScore;
      if (sortBy === 'score_asc') return a.totalScore - b.totalScore;
      if (sortBy === 'name') return a.studentName.localeCompare(b.studentName, 'vi');
      return 0; // Mặc định theo thời gian nộp
    });

  // Sao chép link làm bài thi
  const handleCopyExamLink = () => {
    const testLink = `${window.location.origin}/exam-test/${session.id}`;
    navigator.clipboard.writeText(testLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Xuất file Excel (.csv với BOM chuẩn tiếng Việt cho Microsoft Excel)
  const handleExportExcel = () => {
    if (filteredResults.length === 0) {
      alert('Chưa có kết quả làm bài để xuất file Excel.');
      return;
    }

    const headers = ['STT', 'SBD', 'Học sinh', 'Tổng điểm', 'P1', 'P2', 'P3', 'P4', 'Bắt đầu', 'Nộp bài', 'Trạng thái'];
    const rows = filteredResults.map((r, i) => [
      i + 1,
      r.sbd,
      `"${r.studentName}"`,
      r.totalScore.toFixed(2),
      `"${r.p1}"`,
      `"${r.p2}"`,
      `"${r.p3}"`,
      `"${r.p4}"`,
      `"${r.startedAtStr}"`,
      `"${r.submittedAtStr}"`,
      `"${r.status}"`
    ]);

    const csvContent = '\ufeff' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Ket_Qua_${session.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Tính toán thống kê từ dữ liệu bài thi thực tế
  const totalCount = results.length;
  const avgScore = totalCount > 0
    ? (results.reduce((acc, cur) => acc + cur.totalScore, 0) / totalCount).toFixed(2)
    : '0.00';
  const maxScoreItem = totalCount > 0
    ? results.reduce((prev, current) => (prev.totalScore > current.totalScore) ? prev : current, results[0])
    : { totalScore: 0, studentName: 'Chưa có' };
  const minScoreItem = totalCount > 0
    ? results.reduce((prev, current) => (prev.totalScore < current.totalScore) ? prev : current, results[0])
    : { totalScore: 0, studentName: 'Chưa có' };

  return (
    <div className="flex-1 bg-white min-h-screen p-4 md:p-6 font-sans">
      {/* ========================================================= */}
      {/* THANH TIÊU ĐỀ TRÊN CÙNG: Kết quả làm bài & LOGO SỰ ĐIỆN   */}
      {/* ========================================================= */}
      <div className="flex items-center justify-between pb-4 mb-3 border-b border-gray-100">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight">
          Kết quả làm bài
        </h1>

        {/* LOGO SỰ ĐIỆN VỚI HUY HIỆU TRÒN (GÓC TRÊN PHẢI) */}
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full border-2 border-rose-300 p-0.5 bg-white flex items-center justify-center shadow-xs">
            <div className="w-full h-full rounded-full bg-linear-to-tr from-amber-400 via-rose-500 to-indigo-600 flex flex-col items-center justify-center text-white text-[8px] font-black leading-none">
              <span>SỰ</span>
              <span>ĐIỆN</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* BANNER XÁM ĐẬM: QUAY LẠI & KHUNG THÔNG TIN PHIÊN KIỂM TRA */}
      {/* ========================================================= */}
      <div className="bg-[#4f5d73] text-white rounded-2xl p-4 md:p-5 mb-5 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Nút Quay lại */}
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold cursor-pointer transition-colors shrink-0 self-start md:self-center"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Quay lại</span>
        </button>

        {/* Khung Thông tin chi tiết giữa banner */}
        <div className="border border-white/25 rounded-xl px-5 py-2.5 text-center text-xs leading-relaxed max-w-xl w-full bg-white/5 backdrop-blur-2xs">
          <div className="font-bold text-sm tracking-wide">
            {session.name} <span className="font-normal italic text-slate-200">(Đề: {session.examTitle})</span>
          </div>
          <div className="text-[11px] text-slate-200 mt-0.5">
            Kỳ kiểm tra: <span className="font-bold text-white">ÔN THI TN</span> | Thời gian: <span className="font-bold text-white">90 phút</span> | Lớp: <span className="font-bold text-white">{session.className || 'Tự do'}</span>
          </div>
          <div className="text-[11px] text-slate-300 mt-0.5">
            Ngày bắt đầu: <span className="font-mono">{session.startDateStr || '14:50:51 13/4/2026'}</span> - Ngày kết thúc: <span className="font-mono">{session.endDateStr || '14:50:00 10/6/2026'}</span>
          </div>
        </div>

        {/* Nút Mở bài thi để làm thử / kiểm tra */}
        <a
          href={`/exam-test/${session.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer transition-colors shrink-0 self-end md:self-center shadow-xs"
          title="Mở đề thi để học sinh làm bài hoặc giáo viên làm thử"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Làm bài thi</span>
        </a>
      </div>

      {/* ========================================================= */}
      {/* THANH TIÊU ĐỀ PHỤ: Danh sách có X kết quả & THỐNG KÊ      */}
      {/* ========================================================= */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg md:text-xl font-bold text-gray-900 tracking-tight">
            Danh sách có {filteredResults.length} kết quả
          </h2>
          {loading && (
            <div className="w-4 h-4 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
          )}
        </div>

        {/* Nút Thống kê */}
        <button
          type="button"
          onClick={() => setShowStatsModal(true)}
          className="inline-flex items-center gap-2 px-5 py-2 bg-[#0d9488] hover:bg-[#0f766e] text-white font-bold text-xs rounded-lg shadow-sm cursor-pointer transition-all active:scale-95"
        >
          <BarChart2 className="w-4 h-4" />
          <span>Thống kê</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* DÒNG BỘ LỌC & HÀNH ĐỘNG XUẤT EXCEL                         */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end mb-4 bg-gray-50/70 p-3.5 rounded-xl border border-gray-200/80">
        {/* Tìm theo tên học sinh */}
        <div className="md:col-span-4">
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">
            Tìm theo tên học sinh
          </label>
          <div className="relative">
            <input
              type="text"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              placeholder="Nhập tên học sinh"
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            {searchName && (
              <button
                onClick={() => setSearchName('')}
                className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Sắp xếp theo */}
        <div className="md:col-span-3">
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">
            Sắp xếp theo
          </label>
          <select
            value={sortBy}
            onChange={(e: any) => setSortBy(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
          >
            <option value="time">Thời gian nộp bài</option>
            <option value="score_desc">Điểm số cao nhất</option>
            <option value="score_asc">Điểm số thấp nhất</option>
            <option value="name">Tên học sinh (A-Z)</option>
          </select>
        </div>

        {/* Trạng thái */}
        <div className="md:col-span-3">
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">
            Trạng thái
          </label>
          <select
            value={filterStatus}
            onChange={(e: any) => setFilterStatus(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
          >
            <option value="all">Tất cả</option>
            <option value="Đúng giờ">Đúng giờ</option>
            <option value="Nộp muộn">Nộp muộn</option>
          </select>
        </div>

        {/* Hành động -> Xuất Excel */}
        <div className="md:col-span-2 flex flex-col items-start md:items-end">
          <span className="block text-xs font-semibold text-gray-700 mb-1.5">
            Hành động
          </span>
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={filteredResults.length === 0}
            className="inline-flex items-center justify-center gap-1.5 w-full px-4 py-2 bg-[#0d9488] hover:bg-[#0f766e] text-white font-bold text-xs rounded-lg shadow-sm cursor-pointer transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Xuất bảng điểm ra file Excel (.csv)"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Xuất Excel</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* BẢNG KẾT QUẢ BÀI LÀM THỰC TẾ                              */}
      {/* ========================================================= */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-white text-gray-600 border-b border-gray-200 font-semibold">
                <th className="py-3 px-3.5 w-14">STT</th>
                <th className="py-3 px-3.5 w-16">SBD</th>
                <th className="py-3 px-4 min-w-[180px]">Học sinh</th>
                <th className="py-3 px-4 w-28">Tổng điểm</th>
                <th className="py-3 px-4 min-w-[110px]">P1</th>
                <th className="py-3 px-4 min-w-[170px]">P2</th>
                <th className="py-3 px-4 min-w-[90px]">P3</th>
                <th className="py-3 px-4 w-16">P4</th>
                <th className="py-3 px-4 min-w-[150px]">Bắt đầu</th>
                <th className="py-3 px-4 min-w-[150px]">Nộp bài</th>
                <th className="py-3 px-4 min-w-[100px]">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-16 text-center text-gray-500">
                    <div className="w-7 h-7 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span className="text-xs">Đang tải kết quả bài làm...</span>
                  </td>
                </tr>
              ) : filteredResults.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-14 text-center">
                    <div className="max-w-md mx-auto space-y-3 px-4">
                      <div className="w-12 h-12 bg-teal-50 text-teal-700 rounded-full flex items-center justify-center mx-auto border border-teal-200">
                        <Users className="w-6 h-6" />
                      </div>
                      <h3 className="font-bold text-gray-800 text-sm">Chưa có bài làm nào được nộp</h3>
                      <p className="text-xs text-gray-500 leading-relaxed">
                        Học sinh khi hoàn thành bài thi qua đường link sẽ tự động được hệ thống chấm điểm và cập nhật kết quả trực tiếp tại bảng này theo thời gian thực.
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                        <button
                          type="button"
                          onClick={handleCopyExamLink}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer transition-all active:scale-95"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>{copied ? 'Đã sao chép link!' : 'Sao chép link làm bài'}</span>
                        </button>
                        <a
                          href={`/exam-test/${session.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer transition-all active:scale-95"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Làm bài thử ngay</span>
                        </a>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredResults.map((item, idx) => (
                  <tr
                    key={`${item.id || 'res'}_${idx}`}
                    className="hover:bg-teal-50/40 transition-colors"
                  >
                    {/* STT */}
                    <td className="py-3.5 px-3.5 font-medium text-gray-500">
                      {idx + 1}
                    </td>

                    {/* SBD */}
                    <td className="py-3.5 px-3.5 font-medium text-gray-600 font-mono">
                      {item.sbd}
                    </td>

                    {/* Học sinh */}
                    <td className="py-3.5 px-4 font-semibold text-gray-900">
                      {item.studentName}
                    </td>

                    {/* Tổng điểm (Chữ màu xanh dương đậm in đậm chuẩn) */}
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-blue-600 text-[13px]">
                        {item.totalScore.toFixed(2)}
                      </span>
                    </td>

                    {/* P1 */}
                    <td className="py-3.5 px-4 font-mono text-gray-600 text-[11px]">
                      {item.p1}
                    </td>

                    {/* P2 */}
                    <td className="py-3.5 px-4 font-mono text-gray-600 text-[11px]">
                      {item.p2}
                    </td>

                    {/* P3 */}
                    <td className="py-3.5 px-4 font-mono text-gray-600 text-[11px]">
                      {item.p3}
                    </td>

                    {/* P4 */}
                    <td className="py-3.5 px-4 font-mono text-gray-600 text-[11px]">
                      {item.p4}
                    </td>

                    {/* Bắt đầu */}
                    <td className="py-3.5 px-4 font-mono text-gray-600 text-[11px]">
                      {item.startedAtStr}
                    </td>

                    {/* Nộp bài */}
                    <td className="py-3.5 px-4 font-mono text-gray-600 text-[11px]">
                      {item.submittedAtStr}
                    </td>

                    {/* Trạng thái & Vi phạm */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        <span
                          className={`font-semibold text-[11px] block ${
                            item.status.includes('thu bài') || item.status.includes('Gian lận')
                              ? 'text-rose-600 font-bold'
                              : 'text-emerald-700'
                          }`}
                        >
                          {item.status}
                        </span>
                        {item.violationLogs && item.violationLogs.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => setSelectedStudentForViolation(item)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors cursor-pointer"
                            title="Xem chi tiết các thao tác vi phạm quy chế"
                          >
                            <ShieldAlert className="w-3 h-3 text-rose-600" />
                            <span>{item.violationLogs.length} vi phạm</span>
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Chuẩn quy chế</span>
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODAL THỐNG KÊ KẾT QUẢ BÀI THI                            */}
      {/* ========================================================= */}
      {showStatsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2 text-teal-800">
                <BarChart2 className="w-5 h-5 text-teal-600" />
                <h3 className="text-base font-bold text-gray-900">
                  Thống kê kết quả thi: {session.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowStatsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {totalCount === 0 ? (
              <div className="py-8 text-center text-gray-500 text-xs space-y-2">
                <p>Chưa có học sinh nào nộp bài thi để thống kê.</p>
                <p className="text-[11px] text-gray-400">Dữ liệu sẽ tự động được tổng hợp khi có bài nộp.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-teal-50/70 rounded-2xl border border-teal-100 space-y-1">
                    <span className="text-gray-500 block">Tổng số bài nộp</span>
                    <span className="text-2xl font-bold text-teal-800">{totalCount} học sinh</span>
                  </div>

                  <div className="p-3 bg-emerald-50/70 rounded-2xl border border-emerald-100 space-y-1">
                    <span className="text-gray-500 block">Điểm trung bình</span>
                    <span className="text-2xl font-bold text-emerald-700">{avgScore} đ</span>
                  </div>

                  <div className="p-3 bg-blue-50/70 rounded-2xl border border-blue-100 space-y-1">
                    <span className="text-gray-500 block">Điểm cao nhất</span>
                    <span className="text-xl font-bold text-blue-700">{maxScoreItem.totalScore} đ</span>
                    <span className="text-[10px] text-gray-500 truncate block">({maxScoreItem.studentName})</span>
                  </div>

                  <div className="p-3 bg-amber-50/70 rounded-2xl border border-amber-100 space-y-1">
                    <span className="text-gray-500 block">Điểm thấp nhất</span>
                    <span className="text-xl font-bold text-amber-700">{minScoreItem.totalScore} đ</span>
                    <span className="text-[10px] text-gray-500 truncate block">({minScoreItem.studentName})</span>
                  </div>
                </div>

                {/* Phổ điểm */}
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200/80 space-y-2 text-xs">
                  <span className="font-bold text-gray-800 block">Phổ điểm bài thi:</span>
                  <div className="space-y-1.5">
                    {[
                      { label: 'Điểm giỏi (≥ 8.00)', count: results.filter(r => r.totalScore >= 8).length, color: 'bg-emerald-500' },
                      { label: 'Điểm khá (6.50 - 7.75)', count: results.filter(r => r.totalScore >= 6.5 && r.totalScore < 8).length, color: 'bg-teal-500' },
                      { label: 'Điểm trung bình (5.00 - 6.25)', count: results.filter(r => r.totalScore >= 5 && r.totalScore < 6.5).length, color: 'bg-blue-500' },
                      { label: 'Điểm dưới 5.00', count: results.filter(r => r.totalScore < 5).length, color: 'bg-amber-500' },
                    ].map((tier, tIdx) => {
                      const pct = totalCount > 0 ? Math.round((tier.count / totalCount) * 100) : 0;
                      return (
                        <div key={tIdx} className="space-y-0.5">
                          <div className="flex justify-between text-[11px] text-gray-600">
                            <span>{tier.label}</span>
                            <span className="font-bold">{tier.count} hs ({pct}%)</span>
                          </div>
                          <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${tier.color} rounded-full transition-all duration-300`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowStatsModal(false)}
                className="px-5 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ========================================================= */}
      {/* MODAL: CHI TIẾT VI PHẠM QUY CHẾ THI TRỰC TUYẾN             */}
      {/* ========================================================= */}
      {selectedStudentForViolation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2 text-rose-700">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
                <h3 className="text-base font-bold text-gray-900">
                  Nhật ký vi phạm quy chế thi
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudentForViolation(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 bg-rose-50/70 rounded-2xl border border-rose-200/80 space-y-1.5 text-xs text-rose-950">
              <div className="flex justify-between items-center font-bold">
                <span>Học sinh: {selectedStudentForViolation.studentName} (SBD: {selectedStudentForViolation.sbd})</span>
                <span className="text-blue-700">{selectedStudentForViolation.totalScore.toFixed(2)} điểm</span>
              </div>
              <div className="text-[11px] text-rose-800 flex items-center gap-2">
                <span>Trạng thái: <b>{selectedStudentForViolation.status}</b></span>
                {selectedStudentForViolation.tabSwitchCount ? (
                  <span className="px-2 py-0.5 bg-rose-200/60 rounded-full font-bold">
                    Chuyển tab {selectedStudentForViolation.tabSwitchCount} lần
                  </span>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-gray-800">
                Chi tiết các thao tác vi phạm được hệ thống ghi nhận:
              </h4>

              {(!selectedStudentForViolation.violationLogs || selectedStudentForViolation.violationLogs.length === 0) ? (
                <p className="text-xs text-gray-500 py-4 text-center">
                  Không có nhật ký vi phạm nào.
                </p>
              ) : (
                <div className="max-h-60 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-100 text-xs">
                  {selectedStudentForViolation.violationLogs.map((log, lIdx) => (
                    <div key={lIdx} className="p-2.5 flex items-start gap-2.5 bg-white hover:bg-gray-50">
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded font-mono text-[10px] shrink-0 mt-0.5">
                        {log.time}
                      </span>
                      <div className="space-y-0.5 flex-1">
                        <span className="font-bold text-rose-700 block">
                          {log.type}
                        </span>
                        <span className="text-gray-600 text-[11px] block">
                          {log.details}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedStudentForViolation(null)}
                className="px-5 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

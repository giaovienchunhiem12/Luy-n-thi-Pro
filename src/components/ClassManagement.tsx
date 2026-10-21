import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { useAuth } from '../context/AuthContext';
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  doc,
  deleteDoc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import {
  ArrowLeft,
  Plus,
  Search,
  Users,
  GraduationCap,
  Calendar,
  Trash2,
  FileSpreadsheet,
  Download,
  Eye,
  X,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  UserMinus,
  CheckSquare,
  Square
} from 'lucide-react';

interface Student {
  id: string; // Số báo danh
  name: string; // Họ và tên
}

interface ClassItem {
  id: string;
  name: string;
  grade: string;
  academicYear: string;
  teacherId: string;
  students: Student[];
  createdAt?: any;
}

export default function ClassManagement() {
  const { user: authUser } = useAuth();
  // Chế độ xem: 'list' (danh sách lớp) | 'create' (tạo mới lớp theo mẫu) | 'detail' (chi tiết lớp & học sinh)
  const [mode, setMode] = useState<'list' | 'create' | 'detail'>('list');
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);

  // Form tạo lớp mới
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('');
  const [academicYear, setAcademicYear] = useState('2026-2027');
  const [students, setStudents] = useState<Student[]>([]);
  const [pastedData, setPastedData] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Thông báo (Toast)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Lọc và tìm kiếm danh sách lớp
  const [searchQuery, setSearchQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState('all');

  // Thêm học sinh trong trang chi tiết
  const [newSbd, setNewSbd] = useState('');
  const [newName, setNewName] = useState('');
  const [studentSearch, setStudentSearch] = useState('');

  // Chọn học sinh để xóa nhiều
  const [selectedStudentIndices, setSelectedStudentIndices] = useState<number[]>([]);

  // Modals xác nhận xóa (thay thế hoàn toàn window.confirm để chạy trơn tru trong iframe)
  const [classToDelete, setClassToDelete] = useState<ClassItem | null>(null);
  const [isDeletingClass, setIsDeletingClass] = useState(false);

  const [studentToDelete, setStudentToDelete] = useState<{ index: number; student: Student } | null>(null);
  const [isDeletingStudent, setIsDeletingStudent] = useState(false);

  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Lắng nghe dữ liệu lớp học theo giáo viên đăng nhập
  useEffect(() => {
    const user = auth.currentUser || authUser;
    if (!user) {
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'classes'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: ClassItem[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<ClassItem, 'id'>)
        }));
        list.sort((a, b) => a.name.localeCompare(b.name));
        setClasses(list);
        setLoading(false);


        // Cập nhật selectedClass realtime nếu đang xem chi tiết
        if (selectedClass) {
          const updated = list.find((c) => c.id === selectedClass.id);
          if (updated) {
            setSelectedClass(updated);
          }
        }
      },
      (error) => {
        console.error('Lỗi tải danh sách lớp:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [selectedClass?.id]);

  // Tự động đóng thông báo sau 4 giây
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Xử lý dán dữ liệu từ Excel
  const handlePaste = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setPastedData(text);

    if (!text.trim()) {
      setStudents([]);
      return;
    }

    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const parsedStudents: Student[] = [];

    lines.forEach((line, index) => {
      let parts = line.split('\t').map((p) => p.trim());
      if (parts.length === 1 && line.includes(',')) {
        parts = line.split(',').map((p) => p.trim());
      } else if (parts.length === 1 && line.includes(';')) {
        parts = line.split(';').map((p) => p.trim());
      }

      if (parts.length >= 2) {
        parsedStudents.push({
          id: parts[0],
          name: parts.slice(1).join(' ')
        });
      } else if (parts.length === 1 && parts[0]) {
        parsedStudents.push({
          id: `SBD${String(index + 1).padStart(3, '0')}`,
          name: parts[0]
        });
      }
    });

    setStudents(parsedStudents);
  };

  // Tải file Excel mẫu
  const handleDownloadSample = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      'Số báo danh\tHọ và tên\n' +
      'SBD001\tNguyễn Văn An\n' +
      'SBD002\tTrần Thị Mai\n' +
      'SBD003\tLê Hoàng Nam\n' +
      'SBD004\tPhạm Minh Đức\n' +
      'SBD005\tĐỗ Khánh Linh\n';

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'Mau_Danh_Sach_Hoc_Sinh.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Dán dữ liệu thử nghiệm nhanh
  const handleInsertDemoData = () => {
    const demo =
      "SBD001\tNguyễn Văn An\nSBD002\tTrần Thị Mai\nSBD003\tLê Hoàng Nam\nSBD004\tPhạm Minh Đức\nSBD005\tĐỗ Khánh Linh\nSBD006\tVũ Phương Thảo\nSBD007\tHoàng Quốc Huy";
    setPastedData(demo);
    const lines = demo.split('\n');
    setStudents(
      lines.map((line) => {
        const [id, name] = line.split('\t');
        return { id, name };
      })
    );
  };

  // Lưu lớp học mới vào Firestore
  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = auth.currentUser || authUser;
    if (!user) {
      setNotification({ type: 'error', message: 'Bạn cần đăng nhập để tạo lớp.' });
      return;
    }

    if (!name.trim()) {
      setNotification({ type: 'error', message: 'Vui lòng nhập tên lớp học.' });
      return;
    }

    if (!grade) {
      setNotification({ type: 'error', message: 'Vui lòng chọn khối lớp.' });
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'classes'), {
        name: name.trim(),
        grade,
        academicYear,
        teacherId: user.uid || 'teacher_giasudienvan',
        teacherEmail: user.email || 'giasudienvan@gmail.com',
        students: students,
        createdAt: serverTimestamp()
      });

      setName('');
      setGrade('');
      setAcademicYear('2026-2027');
      setStudents([]);
      setPastedData('');

      setNotification({
        type: 'success',
        message: `Đã tạo thành công lớp "${name.trim()}" với ${students.length} học sinh!`
      });

      setMode('list');
    } catch (error: any) {
      console.error('Lỗi khi tạo lớp:', error);
      setNotification({
        type: 'error',
        message: 'Có lỗi xảy ra khi tạo lớp. Vui lòng thử lại.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================
  // THỰC THI XÓA LỚP HỌC (MODAL CONFIRMATION)
  // ==========================================
  const confirmDeleteClass = async () => {
    if (!classToDelete) return;
    setIsDeletingClass(true);

    try {
      await deleteDoc(doc(db, 'classes', classToDelete.id));

      setNotification({
        type: 'success',
        message: `Đã xóa vĩnh viễn lớp "${classToDelete.name}".`
      });

      // Nếu đang trong trang chi tiết lớp này, quay về danh sách
      if (selectedClass?.id === classToDelete.id) {
        setSelectedClass(null);
        setMode('list');
      }

      setClassToDelete(null);
    } catch (error) {
      console.error('Lỗi xóa lớp:', error);
      setNotification({
        type: 'error',
        message: 'Không thể xóa lớp. Vui lòng kiểm tra quyền hạn mạng.'
      });
    } finally {
      setIsDeletingClass(false);
    }
  };

  // ==========================================
  // THỰC THI XÓA 1 HỌC SINH
  // ==========================================
  const confirmDeleteSingleStudent = async () => {
    if (!selectedClass || !studentToDelete) return;
    setIsDeletingStudent(true);

    const updatedStudents = selectedClass.students.filter(
      (_, idx) => idx !== studentToDelete.index
    );

    try {
      await updateDoc(doc(db, 'classes', selectedClass.id), {
        students: updatedStudents
      });

      setSelectedClass({
        ...selectedClass,
        students: updatedStudents
      });

      setNotification({
        type: 'success',
        message: `Đã xóa học sinh "${studentToDelete.student.name}" khỏi lớp.`
      });

      setStudentToDelete(null);
      // Reset checkbox nếu có
      setSelectedStudentIndices((prev) =>
        prev
          .filter((idx) => idx !== studentToDelete.index)
          .map((idx) => (idx > studentToDelete.index ? idx - 1 : idx))
      );
    } catch (error) {
      console.error('Lỗi xóa học sinh:', error);
      setNotification({
        type: 'error',
        message: 'Không thể xóa học sinh. Vui lòng thử lại.'
      });
    } finally {
      setIsDeletingStudent(false);
    }
  };

  // ==========================================
  // THỰC THI XÓA NHIỀU HỌC SINH ĐÃ CHỌN
  // ==========================================
  const confirmBulkDeleteStudents = async () => {
    if (!selectedClass || selectedStudentIndices.length === 0) return;
    setIsBulkDeleting(true);

    const updatedStudents = selectedClass.students.filter(
      (_, idx) => !selectedStudentIndices.includes(idx)
    );

    try {
      await updateDoc(doc(db, 'classes', selectedClass.id), {
        students: updatedStudents
      });

      setSelectedClass({
        ...selectedClass,
        students: updatedStudents
      });

      setNotification({
        type: 'success',
        message: `Đã xóa ${selectedStudentIndices.length} học sinh khỏi lớp thành công.`
      });

      setSelectedStudentIndices([]);
      setShowBulkDeleteModal(false);
    } catch (error) {
      console.error('Lỗi xóa nhiều học sinh:', error);
      setNotification({
        type: 'error',
        message: 'Không thể cập nhật danh sách học sinh.'
      });
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Thêm từng học sinh thủ công
  const handleAddSingleStudent = async () => {
    if (!selectedClass || !newName.trim()) return;

    const sbd = newSbd.trim() || `SBD${String(selectedClass.students.length + 1).padStart(3, '0')}`;
    const newStudentItem: Student = {
      id: sbd,
      name: newName.trim()
    };

    const updatedList = [...(selectedClass.students || []), newStudentItem];

    try {
      await updateDoc(doc(db, 'classes', selectedClass.id), {
        students: updatedList
      });

      setSelectedClass({
        ...selectedClass,
        students: updatedList
      });

      setNewSbd('');
      setNewName('');

      setNotification({
        type: 'success',
        message: `Đã thêm học sinh ${newName.trim()} vào lớp!`
      });
    } catch (error) {
      console.error('Lỗi thêm học sinh:', error);
      setNotification({
        type: 'error',
        message: 'Không thể thêm học sinh. Vui lòng thử lại.'
      });
    }
  };

  // Toggle chọn học sinh
  const toggleSelectStudent = (index: number) => {
    setSelectedStudentIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  // Toggle chọn tất cả học sinh
  const toggleSelectAll = (allFilteredIndices: number[]) => {
    if (selectedStudentIndices.length === allFilteredIndices.length) {
      setSelectedStudentIndices([]);
    } else {
      setSelectedStudentIndices(allFilteredIndices);
    }
  };

  // Lọc lớp học
  const filteredClasses = classes.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGrade = gradeFilter === 'all' || c.grade === gradeFilter;
    return matchesSearch && matchesGrade;
  });

  return (
    <div className="flex-1 bg-gray-50/60 min-h-screen p-6 md:p-8 relative">
      {/* Toast thông báo góc phải */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-sm transition-all duration-200 animate-in fade-in slide-in-from-top-2 ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span className="font-medium">{notification.message}</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL XÁC NHẬN XÓA LỚP HỌC (Custom React Modal)            */}
      {/* ========================================================= */}
      {classToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Xác nhận xóa lớp học</h3>
                <p className="text-xs text-gray-500">Thao tác này sẽ xóa vĩnh viễn dữ liệu lớp</p>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl space-y-1.5 text-xs text-gray-600 border border-gray-100">
              <div className="flex justify-between">
                <span className="text-gray-500">Tên lớp:</span>
                <span className="font-bold text-gray-900">{classToDelete.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Khối & Năm học:</span>
                <span className="font-medium text-gray-800">
                  {classToDelete.grade} · {classToDelete.academicYear}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Sĩ số học sinh:</span>
                <span className="font-bold text-rose-600">{classToDelete.students?.length || 0} học sinh</span>
              </div>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
              Bạn có chắc chắn muốn xóa lớp học này không? Danh sách học sinh và kết quả liên quan sẽ bị xóa khỏi hệ thống và không thể khôi phục.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setClassToDelete(null)}
                disabled={isDeletingClass}
                className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100 font-medium text-xs transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={confirmDeleteClass}
                disabled={isDeletingClass}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs shadow-sm hover:shadow transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isDeletingClass ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Đang xóa...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Xác nhận xóa lớp</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL XÁC NHẬN XÓA 1 HỌC SINH                              */}
      {/* ========================================================= */}
      {studentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
                <UserMinus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Xóa học sinh khỏi lớp</h3>
                <p className="text-xs text-gray-500">Xác nhận xóa em học sinh này</p>
              </div>
            </div>

            <div className="p-3.5 bg-gray-50 rounded-xl space-y-1 text-xs text-gray-700 border border-gray-100">
              <div>
                <span className="text-gray-500">Họ và tên: </span>
                <span className="font-bold text-gray-900">{studentToDelete.student.name}</span>
              </div>
              <div>
                <span className="text-gray-500">Số báo danh: </span>
                <span className="font-mono font-semibold text-teal-800">{studentToDelete.student.id}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setStudentToDelete(null)}
                disabled={isDeletingStudent}
                className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100 text-xs font-medium cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={confirmDeleteSingleStudent}
                disabled={isDeletingStudent}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeletingStudent ? (
                  <span>Đang xóa...</span>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa học sinh</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL XÁC NHẬN XÓA NHIỀU HỌC SINH ĐÃ CHỌN                  */}
      {/* ========================================================= */}
      {showBulkDeleteModal && selectedClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Xóa nhiều học sinh</h3>
                <p className="text-xs text-gray-500">Đã chọn {selectedStudentIndices.length} học sinh</p>
              </div>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Bạn có chắc chắn muốn xóa <span className="font-bold text-rose-600">{selectedStudentIndices.length}</span> học sinh đã chọn khỏi lớp <span className="font-bold">{selectedClass.name}</span>?
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(false)}
                disabled={isBulkDeleting}
                className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100 text-xs font-medium cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={confirmBulkDeleteStudents}
                disabled={isBulkDeleting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isBulkDeleting ? <span>Đang xóa...</span> : <span>Xác nhận xóa</span>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW 1: TẠO MỚI LỚP HỌC (THEO MẪU HÌNH ẢNH)                */}
      {/* ========================================================= */}
      {mode === 'create' && (
        <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-800">Tạo mới lớp học</h1>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs border border-teal-200">
                PRO
              </span>
            </div>
          </div>

          <div className="p-6 md:p-8">
            <div className="flex items-center justify-between mb-6">
              <button
                type="button"
                onClick={() => setMode('list')}
                className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 font-medium text-sm transition-colors py-1.5 px-2 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Quay lại</span>
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleInsertDemoData}
                  className="text-xs text-gray-500 hover:text-teal-700 underline cursor-pointer"
                >
                  Dán mẫu thử
                </button>
                <button
                  type="button"
                  onClick={handleDownloadSample}
                  className="text-sm text-gray-700 hover:text-teal-700 flex items-center gap-1 cursor-pointer"
                >
                  <span>Tải Excel mẫu</span>
                  <span className="text-blue-600 font-semibold hover:underline">tại đây</span>
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateClass} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">Tên Lớp:</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nhập tên lớp (vd: 12A1, 10 Lý...)"
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-md text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all placeholder:text-gray-400"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">Khối:</label>
                  <select
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-md text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all cursor-pointer"
                    required
                  >
                    <option value="">Chọn khối</option>
                    <option value="Khối 10">Khối 10</option>
                    <option value="Khối 11">Khối 11</option>
                    <option value="Khối 12">Khối 12</option>
                    <option value="Luyện thi đại học">Luyện thi đại học</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">Năm học:</label>
                  <select
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-md text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all cursor-pointer"
                  >
                    <option value="2026-2027">2026-2027</option>
                    <option value="2025-2026">2025-2026</option>
                  </select>
                </div>
              </div>

              <div className="w-full py-2.5 px-4 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-600 font-medium">
                {students.length} học sinh
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">
                    Copy từ Excel dán vào
                  </label>
                  <textarea
                    value={pastedData}
                    onChange={handlePaste}
                    placeholder={"Dán cột SBD và Họ tên từ Excel vào đây...\nVí dụ:\nSBD001\tNguyễn Văn A\nSBD002\tTrần Thị B"}
                    rows={12}
                    className="w-full p-3.5 bg-white border border-gray-900 rounded-md font-mono text-sm leading-relaxed text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all resize-y"
                  />
                  <p className="text-xs text-gray-500 mt-1.5">
                    Mẹo: Trong Excel chọn 2 cột (Số báo danh, Họ và tên) nhấn Ctrl+C và dán thẳng vào ô này.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-2">Số báo danh</label>
                    <div className="h-[285px] bg-[#f4f5f7] rounded-md border border-gray-200 p-3 overflow-y-auto space-y-2">
                      {students.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-xs text-gray-400 text-center">
                          Chưa có dữ liệu
                        </div>
                      ) : (
                        students.map((s, idx) => (
                          <div
                            key={idx}
                            className="text-sm font-mono text-gray-800 py-1 border-b border-gray-200/60 last:border-0 truncate"
                            title={s.id}
                          >
                            {s.id || `SBD${String(idx + 1).padStart(3, '0')}`}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-2">Họ và tên</label>
                    <div className="h-[285px] bg-[#f4f5f7] rounded-md border border-gray-200 p-3 overflow-y-auto space-y-2">
                      {students.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-xs text-gray-400 text-center">
                          Chưa có dữ liệu
                        </div>
                      ) : (
                        students.map((s, idx) => (
                          <div
                            key={idx}
                            className="text-sm text-gray-800 py-1 border-b border-gray-200/60 last:border-0 truncate font-medium"
                            title={s.name}
                          >
                            {s.name || '(Chưa có tên)'}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-center">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-medium px-10 py-3 rounded-lg shadow-sm hover:shadow transition-all text-sm tracking-wide disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Đang lưu lớp học...</span>
                    </>
                  ) : (
                    <span>Tạo lớp học</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW 2: CHI TIẾT LỚP HỌC & QUẢN LÝ / XÓA HỌC SINH         */}
      {/* ========================================================= */}
      {mode === 'detail' && selectedClass && (
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Header chi tiết lớp */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <button
                onClick={() => {
                  setSelectedClass(null);
                  setSelectedStudentIndices([]);
                  setMode('list');
                }}
                className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-900 text-sm font-medium mb-3 py-1 px-2 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Quay lại danh sách</span>
              </button>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">{selectedClass.name}</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200">
                  {selectedClass.grade}
                </span>
                <span className="text-sm text-gray-500 font-medium">
                  Năm học: {selectedClass.academicYear}
                </span>
              </div>
            </div>

            {/* NÚT XÓA LỚP HỌC NỔI BẬT */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setClassToDelete(selectedClass)}
                className="px-4 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-xs hover:shadow"
                title="Xóa toàn bộ lớp này"
              >
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>XÓA LỚP HỌC NÀY</span>
              </button>
            </div>
          </div>

          {/* Form thêm từng học sinh */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Plus className="w-4 h-4 text-teal-600" />
              <span>Thêm học sinh mới vào lớp</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                value={newSbd}
                onChange={(e) => setNewSbd(e.target.value)}
                placeholder="Số báo danh (vd: SBD009)"
                className="px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Họ và tên học sinh"
                className="px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <button
                onClick={handleAddSingleStudent}
                className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <UserCheck className="w-4 h-4" />
                <span>Thêm vào lớp</span>
              </button>
            </div>
          </div>

          {/* Bảng danh sách học sinh có nút XÓA và XÓA HÀNG LOẠT */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-gray-800 font-bold">
                  <Users className="w-4 h-4 text-teal-600" />
                  <span>Danh sách học sinh ({selectedClass.students?.length || 0})</span>
                </div>

                {/* NÚT XÓA HÀNG LOẠT NẾU CÓ CHỌN */}
                {selectedStudentIndices.length > 0 && (
                  <button
                    onClick={() => setShowBulkDeleteModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-all animate-in fade-in cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa {selectedStudentIndices.length} học sinh đã chọn</span>
                  </button>
                )}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Tìm theo tên hoặc SBD..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            {/* Bảng danh sách */}
            {(!selectedClass.students || selectedClass.students.length === 0) ? (
              <div className="py-16 text-center text-gray-400 text-sm">
                Lớp này hiện chưa có học sinh nào. Thầy cô có thể thêm ở ô phía trên.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50/75 text-xs uppercase tracking-wider text-gray-500 border-b border-gray-100">
                    <tr>
                      <th className="py-3 px-4 w-12 text-center">
                        <input
                          type="checkbox"
                          checked={
                            selectedClass.students.length > 0 &&
                            selectedStudentIndices.length === selectedClass.students.length
                          }
                          onChange={() =>
                            toggleSelectAll(selectedClass.students.map((_, i) => i))
                          }
                          className="rounded border-gray-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                          title="Chọn tất cả học sinh"
                        />
                      </th>
                      <th className="py-3 px-4 w-16 text-center">STT</th>
                      <th className="py-3 px-4 w-36">Số báo danh</th>
                      <th className="py-3 px-4">Họ và tên</th>
                      <th className="py-3 px-4">Mật khẩu</th>
                      <th className="py-3 px-4 text-right">Chức năng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedClass.students.map((student, idx) => {
                      const matchesSearch =
                        student.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
                        student.id.toLowerCase().includes(studentSearch.toLowerCase());

                      if (!matchesSearch) return null;

                      const isSelected = selectedStudentIndices.includes(idx);

                      return (
                        <tr
                          key={idx}
                          className={`hover:bg-gray-50/75 transition-colors ${
                            isSelected ? 'bg-teal-50/30' : ''
                          }`}
                        >
                          <td className="py-3 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectStudent(idx)}
                              className="rounded border-gray-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-3 px-4 text-center text-gray-400 font-mono text-xs">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-teal-800">
                            {student.id}
                          </td>
                          <td className="py-3 px-4 font-medium text-gray-900">
                            {student.name}
                          </td>
                          <td className="py-3 px-4 font-mono text-gray-600">
                            123
                          </td>
                          <td className="py-3 px-4 text-right">
                            {/* NÚT XÓA HỌC SINH RÕ RÀNG */}
                            <button
                              type="button"
                              onClick={() => setStudentToDelete({ index: idx, student })}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:text-white hover:bg-rose-600 bg-rose-50 border border-rose-200 rounded-lg transition-all cursor-pointer"
                              title="Xóa học sinh này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Xóa</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW 3: DANH SÁCH TẤT CẢ CÁC LỚP HỌC (MAIN CLASS LIST)     */}
      {/* ========================================================= */}
      {mode === 'list' && (
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Quản lý Lớp học</h1>
              <p className="text-sm text-gray-500 mt-1">
                Quản lý các lớp, học sinh, hỗ trợ thêm và xóa lớp nhanh chóng, an toàn.
              </p>
            </div>

            <button
              onClick={() => setMode('create')}
              className="inline-flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold px-5 py-2.5 rounded-xl shadow-sm hover:shadow transition-all text-sm cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo mới lớp học</span>
            </button>
          </div>

          {/* Thống kê nhanh */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tổng số lớp
                </div>
                <div className="text-2xl font-bold text-gray-900">{classes.length}</div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tổng số học sinh
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {classes.reduce((acc, c) => acc + (c.students?.length || 0), 0)}
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Năm học hiện tại
                </div>
                <div className="text-2xl font-bold text-gray-900">2026-2027</div>
              </div>
            </div>
          </div>

          {/* Thanh tìm kiếm & lọc */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm lớp học theo tên..."
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
                className="px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:bg-white focus:ring-2 focus:ring-teal-500 cursor-pointer"
              >
                <option value="all">Tất cả khối lớp</option>
                <option value="Khối 10">Khối 10</option>
                <option value="Khối 11">Khối 11</option>
                <option value="Khối 12">Khối 12</option>
                <option value="Luyện thi đại học">Luyện thi đại học</option>
              </select>
            </div>
          </div>

          {/* Danh sách các thẻ lớp */}
          {loading ? (
            <div className="py-16 text-center">
              <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-500">Đang tải danh sách lớp học...</p>
            </div>
          ) : filteredClasses.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-4">
                <GraduationCap className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-gray-800 mb-1">
                {classes.length === 0 ? 'Chưa có lớp học nào' : 'Không tìm thấy lớp học phù hợp'}
              </h3>
              <p className="text-sm text-gray-500 max-w-md mx-auto mb-6">
                {classes.length === 0
                  ? 'Hãy bấm nút bên dưới để tạo lớp học đầu tiên và nhập danh sách học sinh từ Excel.'
                  : 'Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc khối lớp.'}
              </p>
              {classes.length === 0 && (
                <button
                  onClick={() => setMode('create')}
                  className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold px-5 py-2.5 rounded-xl text-sm shadow-sm transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tạo mới lớp học ngay</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredClasses.map((item) => {
                const count = item.students?.length || 0;
                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl border border-gray-200/90 hover:border-teal-400 shadow-sm hover:shadow-md transition-all p-5 flex flex-col justify-between group"
                  >
                    <div>
                      {/* Tiêu đề & Nút xóa lớp nhanh trên góc */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <h3 className="text-lg font-bold text-gray-900 group-hover:text-teal-700 transition-colors">
                            {item.name}
                          </h3>
                          <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                            <span className="font-semibold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                              {item.grade}
                            </span>
                            <span>·</span>
                            <span>{item.academicYear}</span>
                          </div>
                        </div>

                        {/* NÚT THÙNG RÁC XÓA LỚP */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setClassToDelete(item);
                          }}
                          className="text-gray-400 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-xl transition-all cursor-pointer"
                          title="Xóa lớp học này"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="py-2.5 px-3.5 bg-gray-50 rounded-xl text-xs text-gray-600 flex items-center justify-between mb-4">
                        <span className="flex items-center gap-1.5">
                          <Users className="w-4 h-4 text-gray-400" />
                          <span>Sĩ số học sinh:</span>
                        </span>
                        <span className="font-bold text-gray-900 text-sm">{count} em</span>
                      </div>

                      {/* Preview 3 học sinh đầu tiên */}
                      {count > 0 && (
                        <div className="text-xs text-gray-500 space-y-1 mb-4 border-l-2 border-teal-500/40 pl-2.5">
                          {item.students.slice(0, 3).map((s, idx) => (
                            <div key={idx} className="truncate">
                              <span className="font-mono text-gray-700 font-semibold">{s.id}:</span>{' '}
                              {s.name}
                            </div>
                          ))}
                          {count > 3 && (
                            <div className="text-gray-400 italic">... và {count - 3} học sinh khác</div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* HÀNG NÚT THAO TÁC RÕ RÀNG Ở ĐÁY CARD: XEM HỌC SINH & XÓA LỚP */}
                    <div className="pt-3 border-t border-gray-100 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedClass(item);
                          setSelectedStudentIndices([]);
                          setMode('detail');
                        }}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 font-semibold py-2 px-3 rounded-xl text-xs transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Xem học sinh</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setClassToDelete(item)}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                        title="Xóa lớp học"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        <span>Xóa lớp</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

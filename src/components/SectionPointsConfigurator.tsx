import React from 'react';
import { Sliders, CheckCircle2, Sparkles, Calculator, Award } from 'lucide-react';
import {
  SectionPointsConfig,
  ScoringMode,
  SectionAllocationMethod,
  Part2SubItemDistribution,
  DEFAULT_SECTION_POINTS,
  resolveSectionScoring,
  formatPointBadge
} from '../data/sampleQuestions';

interface SectionPointsConfiguratorProps {
  value: SectionPointsConfig;
  onChange: (newConfig: SectionPointsConfig) => void;
  p1Count: number;
  p2Count: number;
  p3Count: number;
  compact?: boolean;
}

export const SectionPointsConfigurator: React.FC<SectionPointsConfiguratorProps> = ({
  value,
  onChange,
  p1Count,
  p2Count,
  p3Count,
  compact = false
}) => {
  const safeValue: SectionPointsConfig = {
    ...DEFAULT_SECTION_POINTS,
    ...(value || {}),
    p2: {
      ...DEFAULT_SECTION_POINTS.p2,
      ...(value?.p2 || {})
    }
  };

  const resolved = resolveSectionScoring(safeValue, { p1Count, p2Count, p3Count });

  // Hàm cập nhật và đồng bộ các trường điểm để tương thích cả 2 chế độ
  const updateConfig = (patch: Partial<SectionPointsConfig>) => {
    const nextRaw: SectionPointsConfig = {
      ...safeValue,
      ...patch,
      p2: {
        ...safeValue.p2,
        ...(patch.p2 || {})
      }
    };

    const nextResolved = resolveSectionScoring(nextRaw, { p1Count, p2Count, p3Count });

    const synced: SectionPointsConfig = {
      ...nextRaw,
      scoringMode: nextResolved.mode,
      allocationMethod: nextResolved.allocation,
      p2Distribution: nextResolved.p2Dist,
      p1TotalPoints: nextResolved.totalP1,
      p2TotalPoints: nextResolved.totalP2,
      p3TotalPoints: nextResolved.totalP3,
      p1: nextResolved.p1PerQ,
      p2: nextResolved.p2Opts,
      p3: nextResolved.p3PerQ
    };

    onChange(synced);
  };

  const handleModeChange = (mode: ScoringMode) => {
    if (mode === 'standard_2025') {
      updateConfig({
        scoringMode: 'standard_2025',
        allocationMethod: 'per_question',
        p2Distribution: 'progressive',
        p1: safeValue.p1 > 0 ? safeValue.p1 : 0.25,
        p2: {
          opt1: 0.1,
          opt2: 0.25,
          opt3: 0.5,
          opt4: 1.0
        },
        p3: safeValue.p3 > 0 ? safeValue.p3 : 0.25
      });
    } else {
      const initTotalP1 =
        safeValue.p1TotalPoints && safeValue.p1TotalPoints > 0
          ? safeValue.p1TotalPoints
          : p1Count > 0
          ? Math.round(p1Count * (safeValue.p1 || 0.25) * 100) / 100
          : 4.5;
      const initTotalP2 =
        safeValue.p2TotalPoints && safeValue.p2TotalPoints > 0
          ? safeValue.p2TotalPoints
          : p2Count > 0
          ? Math.round(p2Count * (safeValue.p2?.opt4 || 1.0) * 100) / 100
          : 4.0;
      const initTotalP3 =
        safeValue.p3TotalPoints && safeValue.p3TotalPoints > 0
          ? safeValue.p3TotalPoints
          : p3Count > 0
          ? Math.round(p3Count * (safeValue.p3 || 0.25) * 100) / 100
          : 1.5;

      updateConfig({
        scoringMode: 'custom_section',
        allocationMethod: safeValue.allocationMethod || 'section_total',
        p2Distribution: safeValue.p2Distribution || 'progressive',
        p1TotalPoints: initTotalP1,
        p2TotalPoints: initTotalP2,
        p3TotalPoints: initTotalP3
      });
    }
  };

  return (
    <div className="bg-linear-to-br from-teal-50/60 via-white to-amber-50/40 border border-teal-200/90 rounded-2xl p-4 space-y-4 shadow-2xs">
      {/* Header & Chuyển đổi 2 chế độ: Chuẩn Form 2025 vs Tùy chỉnh điểm từng phần */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-teal-100">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="p-1.5 rounded-lg bg-teal-600 text-white shadow-2xs">
              <Calculator className="w-4 h-4" />
            </div>
            <h4 className="text-xs sm:text-sm font-bold text-gray-900">
              Cấu hình thang điểm & Điểm từng phần (Phần I, II, III)
            </h4>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
              Tổng điểm đề: {resolved.totalExam} điểm
            </span>
          </div>
          <p className="text-[11px] text-gray-500 pl-8">
            Giữ nguyên cách chấm chuẩn Form 2025 hoặc cấu hình điểm từng phần cho các đề có số lượng câu hỏi tùy ý
          </p>
        </div>

        {/* 2 Nút chọn chế độ chấm điểm (KHÔNG XÓA BỎ FORM CHUẨN, CHỈ THÊM CẤU HÌNH ĐIỂM TỪNG PHẦN) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 bg-gray-100 p-1 rounded-xl border border-gray-200 shrink-0">
          <button
            type="button"
            onClick={() => handleModeChange('standard_2025')}
            className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              resolved.mode === 'standard_2025'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
            }`}
          >
            <Award className="w-3.5 h-3.5 shrink-0" />
            <span>Theo Form chuẩn 2025</span>
          </button>

          <button
            type="button"
            onClick={() => handleModeChange('custom_section')}
            className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              resolved.mode === 'custom_section'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 shrink-0" />
            <span>Tùy chỉnh điểm từng phần (Số câu tùy ý)</span>
          </button>
        </div>
      </div>

      {/* Thanh tóm tắt số câu thực tế trong từng phần */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
        <div className="px-3 py-2 rounded-xl bg-white border border-teal-200/80 flex items-center justify-between shadow-2xs">
          <div>
            <span className="font-bold text-teal-900 block">Phần I (Trắc nghiệm ABCD)</span>
            <span className="text-[11px] text-gray-500">
              Số lượng: <b className="text-gray-800">{p1Count} câu</b> ({formatPointBadge(resolved.p1PerQ)} đ/câu)
            </span>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-teal-50 text-teal-800 font-extrabold border border-teal-200">
            {resolved.totalP1} đ
          </span>
        </div>

        <div className="px-3 py-2 rounded-xl bg-white border border-teal-200/80 flex items-center justify-between shadow-2xs">
          <div>
            <span className="font-bold text-teal-900 block">Phần II (Đúng / Sai a,b,c,d)</span>
            <span className="text-[11px] text-gray-500">
              Số lượng: <b className="text-gray-800">{p2Count} câu</b> (Tối đa {formatPointBadge(resolved.p2PerQMax)} đ/câu)
            </span>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-teal-50 text-teal-800 font-extrabold border border-teal-200">
            {resolved.totalP2} đ
          </span>
        </div>

        <div className="px-3 py-2 rounded-xl bg-white border border-teal-200/80 flex items-center justify-between shadow-2xs">
          <div>
            <span className="font-bold text-teal-900 block">Phần III (Trả lời ngắn)</span>
            <span className="text-[11px] text-gray-500">
              Số lượng: <b className="text-gray-800">{p3Count} câu</b> ({formatPointBadge(resolved.p3PerQ)} đ/câu)
            </span>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-teal-50 text-teal-800 font-extrabold border border-teal-200">
            {resolved.totalP3} đ
          </span>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* CHẾ ĐỘ 1: CÁCH CHO ĐIỂM THEO FORM CHUẨN 2025 (GIỮ NGUYÊN 100%)         */}
      {/* ===================================================================== */}
      {resolved.mode === 'standard_2025' && (
        <div className="space-y-3 animate-in fade-in duration-150">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-teal-50/80 border border-teal-200 rounded-xl px-3.5 py-2 text-xs text-teal-900">
            <div className="flex items-center gap-1.5 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0" />
              <span>
                Đang áp dụng <b>Cách cho điểm theo Form chuẩn 2025</b> (Phần II tính điểm lũy tiến: 1 ý = 0.1đ, 2 ý = 0.25đ, 3 ý = 0.5đ, 4 ý = 1.0đ).
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() =>
                  updateConfig({
                    scoringMode: 'standard_2025',
                    p1: 0.25,
                    p2: { opt1: 0.1, opt2: 0.25, opt3: 0.5, opt4: 1.0 },
                    p3: 0.25
                  })
                }
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-teal-100 text-teal-800 border border-teal-300 text-[11px] font-bold cursor-pointer transition-colors"
              >
                Chuẩn Lý/Hóa/Sinh (0.25 - 1.0 - 0.25)
              </button>
              <button
                type="button"
                onClick={() =>
                  updateConfig({
                    scoringMode: 'standard_2025',
                    p1: 0.25,
                    p2: { opt1: 0.1, opt2: 0.25, opt3: 0.5, opt4: 1.0 },
                    p3: 0.5
                  })
                }
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-teal-100 text-teal-800 border border-teal-300 text-[11px] font-bold cursor-pointer transition-colors"
              >
                Chuẩn Toán (0.25 - 1.0 - 0.5)
              </button>
            </div>
          </div>

          <div className={`grid grid-cols-1 ${compact ? 'md:grid-cols-3' : 'lg:grid-cols-3'} gap-3`}>
            {/* Phần I */}
            <div className="p-3 bg-white rounded-xl border border-gray-200 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-800">Điểm 1 câu Phần I:</label>
                <span className="text-[11px] text-teal-700 font-semibold">
                  {p1Count} câu × {safeValue.p1} = {resolved.totalP1}đ
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="10"
                  value={safeValue.p1}
                  onChange={(e) => updateConfig({ p1: Math.max(0, parseFloat(e.target.value) || 0) })}
                  className="w-full px-3 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs font-bold text-teal-900 focus:bg-white focus:ring-2 focus:ring-teal-500"
                />
                <span className="text-xs text-gray-500 shrink-0">điểm/câu</span>
              </div>
            </div>

            {/* Phần II */}
            <div className="p-3 bg-white rounded-xl border border-gray-200 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-800">Điểm Phần II (1 - 2 - 3 - 4 ý):</label>
                <span className="text-[11px] text-teal-700 font-semibold">
                  {p2Count} câu × {safeValue.p2.opt4} = {resolved.totalP2}đ
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {(['opt1', 'opt2', 'opt3', 'opt4'] as const).map((key, idx) => (
                  <div key={key}>
                    <span className="block text-[10px] text-gray-500 text-center mb-0.5">{idx + 1} ý đúng</span>
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      max="10"
                      value={safeValue.p2[key]}
                      onChange={(e) =>
                        updateConfig({
                          p2: {
                            ...safeValue.p2,
                            [key]: Math.max(0, parseFloat(e.target.value) || 0)
                          }
                        })
                      }
                      className="w-full px-1.5 py-1 bg-gray-50 border border-gray-300 rounded-lg text-xs font-bold text-center text-teal-900 focus:bg-white focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Phần III */}
            <div className="p-3 bg-white rounded-xl border border-gray-200 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-800">Điểm 1 câu Phần III:</label>
                <span className="text-[11px] text-teal-700 font-semibold">
                  {p3Count} câu × {safeValue.p3} = {resolved.totalP3}đ
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="10"
                  value={safeValue.p3}
                  onChange={(e) => updateConfig({ p3: Math.max(0, parseFloat(e.target.value) || 0) })}
                  className="w-full px-3 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs font-bold text-teal-900 focus:bg-white focus:ring-2 focus:ring-teal-500"
                />
                <span className="text-xs text-gray-500 shrink-0">điểm/câu</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* CHẾ ĐỘ 2: CẤU HÌNH ĐIỂM TỪNG PHẦN CHO ĐỀ TÙY Ý SỐ CÂU HỎI             */}
      {/* ===================================================================== */}
      {resolved.mode === 'custom_section' && (
        <div className="space-y-3.5 animate-in fade-in duration-150">
          {/* Chọn kiểu phân bổ điểm & mẫu chia nhanh */}
          <div className="p-3 bg-amber-50/90 border border-amber-200 rounded-xl space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="text-xs font-bold text-amber-950">
                  Cách tính điểm cho đề tùy ý số câu hỏi ({p1Count} câu P1 - {p2Count} câu P2 - {p3Count} câu P3):
                </span>
              </div>

              <div className="inline-flex bg-white p-0.5 rounded-lg border border-amber-300 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => updateConfig({ allocationMethod: 'section_total' })}
                  className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                    resolved.allocation === 'section_total'
                      ? 'bg-amber-600 text-white'
                      : 'text-amber-900 hover:bg-amber-50'
                  }`}
                >
                  Nhập Tổng điểm từng phần (Tự chia đều)
                </button>
                <button
                  type="button"
                  onClick={() => updateConfig({ allocationMethod: 'per_question' })}
                  className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                    resolved.allocation === 'per_question'
                      ? 'bg-amber-600 text-white'
                      : 'text-amber-900 hover:bg-amber-50'
                  }`}
                >
                  Nhập Điểm mỗi câu từng phần
                </button>
              </div>
            </div>

            {/* Các mẫu tổng điểm từng phần thông dụng */}
            {resolved.allocation === 'section_total' && (
              <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-amber-200/70">
                <span className="text-[11px] font-semibold text-amber-900 mr-1">Gợi ý chia nhanh (Tổng 10đ):</span>
                {[
                  { label: '4.5đ - 4.0đ - 1.5đ', p1: 4.5, p2: 4.0, p3: 1.5 },
                  { label: '3.0đ - 4.0đ - 3.0đ', p1: 3.0, p2: 4.0, p3: 3.0 },
                  { label: '4.0đ - 4.0đ - 2.0đ', p1: 4.0, p2: 4.0, p3: 2.0 },
                  { label: '5.0đ - 3.0đ - 2.0đ', p1: 5.0, p2: 3.0, p3: 2.0 },
                  { label: '6.0đ - 2.0đ - 2.0đ', p1: 6.0, p2: 2.0, p3: 2.0 },
                  { label: '5.0đ - 5.0đ - 0đ', p1: 5.0, p2: 5.0, p3: 0 }
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() =>
                      updateConfig({
                        scoringMode: 'custom_section',
                        allocationMethod: 'section_total',
                        p1TotalPoints: preset.p1,
                        p2TotalPoints: preset.p2,
                        p3TotalPoints: preset.p3
                      })
                    }
                    className="px-2 py-0.5 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-md text-[11px] font-bold cursor-pointer transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 3 Khối cấu hình điểm cho Phần I, Phần II, Phần III */}
          <div className={`grid grid-cols-1 ${compact ? 'md:grid-cols-3' : 'lg:grid-cols-3'} gap-3`}>
            {/* PHẦN I */}
            <div className="p-3.5 bg-white rounded-xl border-2 border-amber-200/90 space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between border-b border-gray-100 pb-1.5">
                <span className="text-xs font-extrabold text-teal-900">PHẦN I ({p1Count} câu)</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">
                  Tổng Phần I: {resolved.totalP1} đ
                </span>
              </div>

              {resolved.allocation === 'section_total' ? (
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-gray-700">
                    Tổng điểm cả Phần I:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      max="100"
                      value={safeValue.p1TotalPoints ?? resolved.totalP1}
                      onChange={(e) =>
                        updateConfig({
                          p1TotalPoints: Math.max(0, parseFloat(e.target.value) || 0)
                        })
                      }
                      className="w-full px-3 py-1.5 bg-amber-50/40 border border-amber-300 rounded-lg text-xs font-extrabold text-gray-900 focus:bg-white focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="text-xs font-semibold text-gray-600 shrink-0">điểm</span>
                  </div>
                  <div className="text-[11px] text-teal-800 bg-teal-50/70 px-2.5 py-1 rounded-md border border-teal-100">
                    → Tự chia đều: <b>{formatPointBadge(resolved.p1PerQ)} điểm / 1 câu</b> ({p1Count} câu)
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-gray-700">
                    Điểm mỗi câu Phần I:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      max="20"
                      value={safeValue.p1}
                      onChange={(e) => {
                        const perQ = Math.max(0, parseFloat(e.target.value) || 0);
                        updateConfig({
                          p1: perQ,
                          p1TotalPoints: Math.round(p1Count * perQ * 100) / 100
                        });
                      }}
                      className="w-full px-3 py-1.5 bg-amber-50/40 border border-amber-300 rounded-lg text-xs font-extrabold text-gray-900 focus:bg-white focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="text-xs font-semibold text-gray-600 shrink-0">đ/câu</span>
                  </div>
                  <div className="text-[11px] text-teal-800 bg-teal-50/70 px-2.5 py-1 rounded-md border border-teal-100">
                    → Tổng Phần I: <b>{resolved.totalP1} điểm</b> ({p1Count} câu)
                  </div>
                </div>
              )}
            </div>

            {/* PHẦN II */}
            <div className="p-3.5 bg-white rounded-xl border-2 border-amber-200/90 space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between border-b border-gray-100 pb-1.5">
                <span className="text-xs font-extrabold text-teal-900">PHẦN II ({p2Count} câu Đúng/Sai)</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">
                  Tổng Phần II: {resolved.totalP2} đ
                </span>
              </div>

              {resolved.allocation === 'section_total' ? (
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-gray-700">
                    Tổng điểm cả Phần II:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      max="100"
                      value={safeValue.p2TotalPoints ?? resolved.totalP2}
                      onChange={(e) =>
                        updateConfig({
                          p2TotalPoints: Math.max(0, parseFloat(e.target.value) || 0)
                        })
                      }
                      className="w-full px-3 py-1.5 bg-amber-50/40 border border-amber-300 rounded-lg text-xs font-extrabold text-gray-900 focus:bg-white focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="text-xs font-semibold text-gray-600 shrink-0">điểm</span>
                  </div>
                  <div className="text-[11px] text-teal-800 bg-teal-50/70 px-2.5 py-1 rounded-md border border-teal-100">
                    → Tối đa 1 câu: <b>{formatPointBadge(resolved.p2PerQMax)} điểm / câu</b> ({p2Count} câu)
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-gray-700">
                    Điểm tối đa mỗi câu Phần II (đúng cả 4 ý):
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="20"
                      value={safeValue.p2.opt4}
                      onChange={(e) => {
                        const maxQ = Math.max(0, parseFloat(e.target.value) || 0);
                        updateConfig({
                          p2: { ...safeValue.p2, opt4: maxQ },
                          p2TotalPoints: Math.round(p2Count * maxQ * 100) / 100
                        });
                      }}
                      className="w-full px-3 py-1.5 bg-amber-50/40 border border-amber-300 rounded-lg text-xs font-extrabold text-gray-900 focus:bg-white focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="text-xs font-semibold text-gray-600 shrink-0">đ/câu</span>
                  </div>
                </div>
              )}

              {/* Tuỳ chọn cách chia điểm 4 ý a, b, c, d trong mỗi câu Phần II */}
              <div className="pt-1 border-t border-gray-100 space-y-1.5">
                <label className="block text-[10px] font-bold text-gray-600 uppercase">
                  Cách tính điểm các ý a), b), c), d) mỗi câu:
                </label>
                <select
                  value={resolved.p2Dist}
                  onChange={(e) => updateConfig({ p2Distribution: e.target.value as Part2SubItemDistribution })}
                  className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-[11px] font-bold text-gray-800 cursor-pointer focus:ring-2 focus:ring-amber-500"
                >
                  <option value="progressive">Lũy tiến chuẩn (10% - 25% - 50% - 100% điểm câu)</option>
                  <option value="equal">Chia đều 4 ý (Mỗi ý đúng = 25% điểm câu)</option>
                  <option value="custom">Tự nhập điểm 1 ý - 2 ý - 3 ý - 4 ý</option>
                </select>

                {resolved.p2Dist === 'custom' ? (
                  <div className="grid grid-cols-4 gap-1 pt-1">
                    {(['opt1', 'opt2', 'opt3', 'opt4'] as const).map((key, idx) => (
                      <div key={key}>
                        <span className="block text-[9px] text-gray-500 text-center">{idx + 1} ý</span>
                        <input
                          type="number"
                          step="0.05"
                          min="0"
                          value={safeValue.p2[key]}
                          onChange={(e) =>
                            updateConfig({
                              p2: {
                                ...safeValue.p2,
                                [key]: Math.max(0, parseFloat(e.target.value) || 0)
                              }
                            })
                          }
                          className="w-full px-1 py-1 bg-white border border-amber-300 rounded text-[11px] font-bold text-center"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[10px] text-gray-600 bg-gray-50 px-2 py-1 rounded border border-gray-200 font-medium">
                    1 ý: <b>{formatPointBadge(resolved.p2Opts.opt1)}đ</b> | 2 ý:{' '}
                    <b>{formatPointBadge(resolved.p2Opts.opt2)}đ</b> | 3 ý:{' '}
                    <b>{formatPointBadge(resolved.p2Opts.opt3)}đ</b> | 4 ý:{' '}
                    <b>{formatPointBadge(resolved.p2Opts.opt4)}đ</b>
                  </div>
                )}
              </div>
            </div>

            {/* PHẦN III */}
            <div className="p-3.5 bg-white rounded-xl border-2 border-amber-200/90 space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between border-b border-gray-100 pb-1.5">
                <span className="text-xs font-extrabold text-teal-900">PHẦN III ({p3Count} câu)</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">
                  Tổng Phần III: {resolved.totalP3} đ
                </span>
              </div>

              {resolved.allocation === 'section_total' ? (
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-gray-700">
                    Tổng điểm cả Phần III:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      max="100"
                      value={safeValue.p3TotalPoints ?? resolved.totalP3}
                      onChange={(e) =>
                        updateConfig({
                          p3TotalPoints: Math.max(0, parseFloat(e.target.value) || 0)
                        })
                      }
                      className="w-full px-3 py-1.5 bg-amber-50/40 border border-amber-300 rounded-lg text-xs font-extrabold text-gray-900 focus:bg-white focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="text-xs font-semibold text-gray-600 shrink-0">điểm</span>
                  </div>
                  <div className="text-[11px] text-teal-800 bg-teal-50/70 px-2.5 py-1 rounded-md border border-teal-100">
                    → Tự chia đều: <b>{formatPointBadge(resolved.p3PerQ)} điểm / 1 câu</b> ({p3Count} câu)
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-gray-700">
                    Điểm mỗi câu Phần III:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      max="20"
                      value={safeValue.p3}
                      onChange={(e) => {
                        const perQ = Math.max(0, parseFloat(e.target.value) || 0);
                        updateConfig({
                          p3: perQ,
                          p3TotalPoints: Math.round(p3Count * perQ * 100) / 100
                        });
                      }}
                      className="w-full px-3 py-1.5 bg-amber-50/40 border border-amber-300 rounded-lg text-xs font-extrabold text-gray-900 focus:bg-white focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="text-xs font-semibold text-gray-600 shrink-0">đ/câu</span>
                  </div>
                  <div className="text-[11px] text-teal-800 bg-teal-50/70 px-2.5 py-1 rounded-md border border-teal-100">
                    → Tổng Phần III: <b>{resolved.totalP3} điểm</b> ({p3Count} câu)
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

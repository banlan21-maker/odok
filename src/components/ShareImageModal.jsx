// src/components/ShareImageModal.jsx
import React, { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import { X, Download, Loader } from 'lucide-react';

const BACKGROUNDS = [
  '/sharing/bg1.jpeg',
  '/sharing/bg2.jpeg',
  '/sharing/bg3.jpeg',
  '/sharing/bg4.jpeg',
  '/sharing/bg5.jpeg',
];

const ShareImageModal = ({ selectedText, bookTitle, authorName, onClose, t = {} }) => {
  const [selectedBg, setSelectedBg] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const canvasRef = useRef(null);

  const displayText = selectedText?.length > 120
    ? selectedText.slice(0, 120).trimEnd() + '…'
    : selectedText;

  // html2canvas로 이미지 생성 후 blob 반환
  const generateBlob = () => new Promise(async (resolve, reject) => {
    try {
      const canvas = await html2canvas(canvasRef.current, {
        useCORS: true,
        allowTaint: false,
        scale: 2,
        backgroundColor: null,
        logging: false,
      });
      canvas.toBlob((blob) => {
        blob ? resolve(blob) : reject(new Error('blob 생성 실패'));
      }, 'image/png');
    } catch (err) {
      reject(err);
    }
  });

  // 카카오톡 공유
  const handleKakao = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setError(null);
    try {
      const blob = await generateBlob();
      const file = new File([blob], 'odok_quote.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: '오독오독',
          text: `"${displayText}"`,
        });
      } else {
        // 폴백: URL 텍스트 공유
        await navigator.share?.({ title: '오독오독', text: `"${displayText}"` });
      }
    } catch (err) {
      if (err.name !== 'AbortError') setError(t.share_error_kakao || '공유에 실패했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };

  // 인스타그램 공유
  const handleInstagram = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setError(null);
    try {
      const blob = await generateBlob();
      const file = new File([blob], 'odok_quote.png', { type: 'image/png' });
      // Instagram Stories: instagram://story 딥링크 시도, 실패 시 네이티브 공유
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: '오독오독' });
      } else {
        setError(t.share_error_instagram_mobile || '인스타그램 공유는 모바일 앱에서만 가능합니다.');
      }
    } catch (err) {
      if (err.name !== 'AbortError') setError(t.share_error_instagram || '공유에 실패했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };

  // 내려받기
  const handleDownload = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setError(null);
    try {
      const blob = await generateBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'odok_quote.png';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(t.share_error_download || '이미지 저장에 실패했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <style>{`
        @keyframes share-slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0); opacity: 1; }
        }
        .share-modal-sheet { animation: share-slide-up 0.3s cubic-bezier(0.32,0.72,0,1) both; }
      `}</style>

      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="share-modal-sheet w-full max-w-sm bg-white dark:bg-slate-800 rounded-t-3xl shadow-2xl pb-10">

          {/* 헤더 */}
          <div className="flex items-center justify-between px-5 pt-5 pb-4">
            <h2 className="text-base font-black text-slate-800 dark:text-slate-100">📢 {t.share_title || '이미지로 공유하기'}</h2>
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-5 space-y-4">

            {/* 선택 문구 */}
            <div className="bg-slate-50 dark:bg-slate-700 rounded-2xl px-4 py-3 border border-slate-100 dark:border-slate-600">
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">{t.share_selected_text || '선택한 문구'}</p>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-relaxed line-clamp-3" style={{ fontFamily: 'serif' }}>
                "{displayText}"
              </p>
            </div>

            {/* 배경 선택 */}
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">{t.share_bg_label || '배경 선택'}</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {BACKGROUNDS.map((bg, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedBg(i)}
                    className={`shrink-0 w-16 h-24 rounded-xl overflow-hidden border-2 transition-all ${
                      selectedBg === i
                        ? 'border-orange-500 scale-105 shadow-md shadow-orange-200 dark:shadow-orange-900/40'
                        : 'border-transparent opacity-60'
                    }`}
                  >
                    <img src={bg} alt={`${t.share_bg_alt || '배경'} ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            {/* 오프스크린 렌더링 캔버스 */}
            <div
              ref={canvasRef}
              style={{
                position: 'fixed', left: '-9999px', top: 0,
                width: '360px', height: '640px',
              }}
            >
              <img
                src={BACKGROUNDS[selectedBg]}
                alt=""
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                crossOrigin="anonymous"
              />
              {/* 가독성 오버레이 */}
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.42) 50%, rgba(0,0,0,0.15) 100%)',
              }} />
              {/* 문구 */}
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: '40px 32px', textAlign: 'center',
              }}>
                <div style={{ fontSize: '44px', lineHeight: 1, color: 'rgba(255,255,255,0.45)', fontFamily: 'Georgia, serif', marginBottom: '6px' }}>"</div>
                <p style={{
                  fontSize: '17px',
                  fontFamily: '"Noto Serif KR","Nanum Myeongjo","Malgun Gothic",serif',
                  color: '#ffffff',
                  lineHeight: 1.85,
                  letterSpacing: '0.02em',
                  textShadow: '0 1px 8px rgba(0,0,0,0.55)',
                  wordBreak: 'keep-all',
                }}>
                  {displayText}
                </p>
                <div style={{ fontSize: '44px', lineHeight: 1, color: 'rgba(255,255,255,0.45)', fontFamily: 'Georgia, serif', marginTop: '6px', transform: 'rotate(180deg)' }}>"</div>
                {bookTitle && (
                  <p style={{
                    marginTop: '18px', fontSize: '11px',
                    color: 'rgba(255,255,255,0.65)',
                    fontFamily: '"Malgun Gothic",sans-serif',
                    letterSpacing: '0.06em',
                  }}>
                    — {bookTitle}{authorName ? ` · ${authorName}` : ''}
                  </p>
                )}
              </div>
            </div>

            {/* 에러 */}
            {error && <p className="text-xs text-red-500 font-bold text-center">{error}</p>}

            {/* 공유 버튼 3개 */}
            <div className="grid grid-cols-3 gap-2">
              {/* 카카오톡 */}
              <button
                onClick={handleKakao}
                disabled={isGenerating}
                className="flex flex-col items-center gap-2 py-3.5 rounded-2xl bg-[#FEE500] hover:bg-[#fad900] active:scale-95 transition-all disabled:opacity-50"
              >
                {isGenerating ? (
                  <Loader className="w-5 h-5 animate-spin text-[#3A1D1D]" />
                ) : (
                  <span className="text-2xl">💬</span>
                )}
                <span className="text-[11px] font-black text-[#3A1D1D]">{t.share_kakao || '카카오톡'}</span>
              </button>

              {/* 인스타그램 */}
              <button
                onClick={handleInstagram}
                disabled={isGenerating}
                className="flex flex-col items-center gap-2 py-3.5 rounded-2xl bg-gradient-to-br from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
              >
                {isGenerating ? (
                  <Loader className="w-5 h-5 animate-spin text-white" />
                ) : (
                  <span className="text-2xl">📸</span>
                )}
                <span className="text-[11px] font-black text-white">{t.share_instagram || '인스타그램'}</span>
              </button>

              {/* 내려받기 */}
              <button
                onClick={handleDownload}
                disabled={isGenerating}
                className="flex flex-col items-center gap-2 py-3.5 rounded-2xl bg-slate-800 dark:bg-slate-600 hover:bg-slate-700 active:scale-95 transition-all disabled:opacity-50"
              >
                {isGenerating ? (
                  <Loader className="w-5 h-5 animate-spin text-white" />
                ) : (
                  <Download className="w-5 h-5 text-white" />
                )}
                <span className="text-[11px] font-black text-white">{t.share_download || '내려받기'}</span>
              </button>
            </div>

          </div>
        </div>
      </div>
    </>
  );
};

export default ShareImageModal;

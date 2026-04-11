// src/components/ShareImageModal.jsx
// Canvas API 직접 사용 (html2canvas 제거 — 모바일 속도 개선)
import React, { useState, useRef, useEffect } from 'react';
import { X, Download, Loader, Share2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';

const BACKGROUNDS = [
  '/sharing/bg1.jpeg',
  '/sharing/bg2.jpeg',
  '/sharing/bg3.jpeg',
  '/sharing/bg4.jpeg',
  '/sharing/bg5.jpeg',
];

const W = 720;
const H = 1280;

// 텍스트 줄바꿈 처리 (Canvas에는 자동 줄바꿈이 없으므로 직접 계산)
function wrapText(ctx, text, maxWidth) {
  const lines = [];
  let line = '';
  for (const char of text) {
    const test = line + char;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = char;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const ShareImageModal = ({ selectedText, bookTitle, authorName, onClose, t = {} }) => {
  const [selectedBg, setSelectedBg] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const bgCacheRef = useRef({});
  const openedAt = useRef(Date.now());

  const displayText = selectedText?.length > 120
    ? selectedText.slice(0, 120).trimEnd() + '…'
    : selectedText;

  // 배경 이미지 프리로드 + 캐시
  const loadBgImage = (idx) => {
    if (bgCacheRef.current[idx]) return Promise.resolve(bgCacheRef.current[idx]);
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => { bgCacheRef.current[idx] = img; resolve(img); };
      img.onerror = () => resolve(null);
      img.src = BACKGROUNDS[idx];
    });
  };

  // Canvas API로 이미지 직접 그리기
  const renderCanvas = async () => {
    const bgImg = await loadBgImage(selectedBg);
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // 1) 배경
    if (bgImg) {
      // cover 모드로 그리기
      const scale = Math.max(W / bgImg.width, H / bgImg.height);
      const sw = W / scale, sh = H / scale;
      const sx = (bgImg.width - sw) / 2, sy = (bgImg.height - sh) / 2;
      ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, W, H);
    } else {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, W, H);
    }

    // 2) 가독성 그라데이션 오버레이
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(0,0,0,0.08)');
    grad.addColorStop(0.5, 'rgba(0,0,0,0.42)');
    grad.addColorStop(1, 'rgba(0,0,0,0.15)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // 3~6) 텍스트 블록 전체를 세로 중앙 정렬
    ctx.textAlign = 'center';

    // 본문 줄바꿈 계산
    ctx.font = '600 34px "Noto Serif KR","Nanum Myeongjo","Malgun Gothic",serif';
    const lines = wrapText(ctx, displayText, W - 128);
    const lineHeight = 60;

    // 전체 블록 높이: 여는따옴표 + 간격 + 본문 + 간격 + 닫는따옴표 + 간격 + 출처
    const quoteSize = 70;
    const gapAfterOpenQuote = 20;
    const gapBeforeCloseQuote = 24;
    const gapBeforeCredit = 36;
    const creditHeight = bookTitle ? 30 : 0;
    const totalHeight = quoteSize + gapAfterOpenQuote + (lines.length * lineHeight) + gapBeforeCloseQuote + quoteSize + gapBeforeCredit + creditHeight;

    // 블록 시작 Y (세로 중앙)
    const blockStartY = (H - totalHeight) / 2;
    let curY = blockStartY;

    // 여는 따옴표
    ctx.font = `${quoteSize}px Georgia, serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillText('"', W / 2, curY + quoteSize * 0.8);
    curY += quoteSize + gapAfterOpenQuote;

    // 본문
    ctx.font = '600 34px "Noto Serif KR","Nanum Myeongjo","Malgun Gothic",serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 16;
    lines.forEach((line, i) => {
      ctx.fillText(line, W / 2, curY + i * lineHeight + lineHeight * 0.7);
    });
    curY += lines.length * lineHeight + gapBeforeCloseQuote;
    ctx.shadowBlur = 0;

    // 닫는 따옴표
    ctx.font = `${quoteSize}px Georgia, serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.save();
    ctx.translate(W / 2, curY + quoteSize * 0.3);
    ctx.rotate(Math.PI);
    ctx.fillText('"', 0, 0);
    ctx.restore();
    curY += quoteSize + gapBeforeCredit;

    // 책 제목 + 저자
    if (bookTitle) {
      ctx.font = '22px "Malgun Gothic", sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      const credit = `— ${bookTitle}${authorName ? ` · ${authorName}` : ''}`;
      ctx.fillText(credit, W / 2, curY);
    }

    // 하단 브랜딩: 오독오독 + 태그라인
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 12;

    // 앱 이름
    ctx.font = '600 28px "Noto Serif KR","Nanum Myeongjo",Georgia,serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('오독오독', W / 2, H - 72);

    // 태그라인
    ctx.font = '300 16px "Noto Serif KR","Nanum Myeongjo","Malgun Gothic",sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('당신의 상상, AI가 써드립니다', W / 2, H - 44);

    ctx.shadowBlur = 0;

    return canvas;
  };

  // 미리보기 업데이트
  useEffect(() => {
    let cancelled = false;
    renderCanvas().then(canvas => {
      if (!cancelled) setPreviewUrl(canvas.toDataURL('image/jpeg', 0.85));
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBg, displayText, bookTitle, authorName]);

  const generateBlob = async () => {
    const canvas = await renderCanvas();
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        blob ? resolve(blob) : reject(new Error('blob 생성 실패'));
      }, 'image/png');
    });
  };

  // 네이티브 공유
  const handleShare = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setError(null);
    try {
      const blob = await generateBlob();
      const file = new File([blob], 'odok_quote.png', { type: 'image/png' });
      if (navigator.share) {
        try {
          await navigator.share({ files: [file], title: '오독오독', text: `"${displayText}"` });
        } catch (shareErr) {
          if (shareErr.name !== 'AbortError') {
            await navigator.share({ title: '오독오독', text: `"${displayText}" — ${bookTitle || ''}` });
          }
        }
      } else {
        setError(t.share_error_general || '공유 기능을 사용할 수 없습니다.');
      }
    } catch (err) {
      if (err.name !== 'AbortError') setError(t.share_error_general || '공유에 실패했습니다.');
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
      if (Capacitor.isNativePlatform() && navigator.share) {
        const file = new File([blob], 'odok_quote.png', { type: 'image/png' });
        await navigator.share({ files: [file], title: 'odok_quote.png' });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'odok_quote.png';
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      if (err.name !== 'AbortError') setError(t.share_error_download || '이미지 저장에 실패했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleBackdrop = (e) => {
    if (e.target !== e.currentTarget) return;
    if (Date.now() - openedAt.current < 200) return;
    onClose();
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
        onClick={handleBackdrop}
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

            {/* 미리보기 */}
            <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-600 shadow-sm">
              {previewUrl ? (
                <img src={previewUrl} alt="미리보기" className="w-full aspect-[9/16] object-cover" />
              ) : (
                <div className="w-full aspect-[9/16] bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                  <Loader className="w-6 h-6 animate-spin text-slate-300" />
                </div>
              )}
            </div>

            {/* 배경 선택 */}
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">{t.share_bg_label || '배경 선택'}</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {BACKGROUNDS.map((bg, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedBg(i)}
                    className={`shrink-0 w-12 h-12 rounded-xl overflow-hidden border-2 transition-all ${
                      selectedBg === i
                        ? 'border-orange-500 scale-110 shadow-md shadow-orange-200 dark:shadow-orange-900/40'
                        : 'border-transparent opacity-60'
                    }`}
                  >
                    <img src={bg} alt={`${t.share_bg_alt || '배경'} ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            {/* 에러 */}
            {error && <p className="text-xs text-red-500 font-bold text-center">{error}</p>}

            {/* 공유 버튼 */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleShare}
                disabled={isGenerating}
                className="flex flex-col items-center gap-2 py-3.5 rounded-2xl bg-orange-500 hover:bg-orange-600 active:scale-95 transition-all disabled:opacity-50"
              >
                {isGenerating ? <Loader className="w-5 h-5 animate-spin text-white" /> : <Share2 className="w-5 h-5 text-white" />}
                <span className="text-[11px] font-black text-white">{t.share_btn || '공유하기'}</span>
              </button>

              <button
                onClick={handleDownload}
                disabled={isGenerating}
                className="flex flex-col items-center gap-2 py-3.5 rounded-2xl bg-slate-800 dark:bg-slate-600 hover:bg-slate-700 active:scale-95 transition-all disabled:opacity-50"
              >
                {isGenerating ? <Loader className="w-5 h-5 animate-spin text-white" /> : <Download className="w-5 h-5 text-white" />}
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

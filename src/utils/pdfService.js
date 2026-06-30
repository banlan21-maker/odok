// src/utils/pdfService.js
// 책 본문을 PDF로 저장 (도화지 아이템).
// 한글 깨짐 방지를 위해 텍스트를 캔버스에 래스터화한 뒤 이미지로 PDF에 삽입한다.
// (jsPDF 기본 폰트는 한글 미지원 → 텍스트 직접 삽입 대신 캔버스 렌더링 방식 사용)
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';

// 페이지 크기 (A4 비율, 150dpi 상당). 본문은 시스템 한글 폰트로도 정상 렌더된다.
const PAGE_W = 1240;
const PAGE_H = 1754;
const MARGIN = 110;
const FOOTER_H = 70;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BODY_BOTTOM = PAGE_H - MARGIN - FOOTER_H;
const MAX_PAGES = 120; // 안전장치 (초장편 폭주 방지)

// Noto Serif KR(웹폰트)가 없으면 시스템 한글 폰트로 폴백 → 한글 깨짐 없음
const FONT = '"Noto Serif KR","Malgun Gothic","Apple SD Gothic Neo","Nanum Myeongjo",sans-serif';

// 캔버스 줄바꿈 (자동 줄바꿈 없음 → 직접 계산)
function wrapText(ctx, text, maxWidth) {
  const lines = [];
  let line = '';
  for (const char of text) {
    if (char === '\n') { lines.push(line); line = ''; continue; }
    const test = line + char;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = char;
    } else {
      line = test;
    }
  }
  lines.push(line);
  return lines;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// 책 → 렌더링할 요소 목록 (제목/저자/화 제목/문단)
function buildElements(book, authorName) {
  const elements = [];
  elements.push({ kind: 'title', text: (book.title || '제목 없음').trim() });
  if (authorName) elements.push({ kind: 'author', text: `글 · ${authorName}` });

  const pushParas = (content) => {
    (content || '')
      .split(/\n+/)
      .map((p) => p.trim())
      .filter(Boolean)
      .forEach((p) => elements.push({ kind: 'para', text: p }));
  };

  const isSeries =
    (book.isSeries || book.category === 'series') &&
    Array.isArray(book.episodes) &&
    book.episodes.length > 0;

  if (isSeries) {
    book.episodes.forEach((ep, i) => {
      elements.push({ kind: 'heading', text: (ep.title || `${i + 1}화`).trim() });
      pushParas(ep.content);
    });
  } else {
    pushParas(book.content);
  }
  return elements;
}

const safeFileName = (title) => {
  const base = (title || 'book').replace(/[\\/:*?"<>|\n\r]/g, ' ').trim().slice(0, 40) || 'book';
  return `오독오독_${base}.pdf`;
};

/**
 * 책을 PDF로 만들어 다운로드(웹) 또는 공유 시트(네이티브)로 저장한다.
 * @param {object} book - { title, content, episodes?, isSeries?, category? }
 * @param {{ authorName?: string }} opts
 * @returns {Promise<{ pages: number }>}
 */
export async function downloadBookPdf(book, { authorName = '' } = {}) {
  if (!book) throw new Error('책 정보가 없습니다.');

  // 가능하면 웹폰트 로드(더 예쁜 명조). 실패해도 시스템 폰트로 한글은 정상 렌더된다.
  try {
    await Promise.all([
      document.fonts.load('400 30px "Noto Serif KR"'),
      document.fonts.load('700 52px "Noto Serif KR"'),
    ]);
    await document.fonts.ready;
  } catch { /* 폴백 폰트 사용 */ }

  const { jsPDF } = await import('jspdf');

  const elements = buildElements(book, authorName);

  const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();

  // 단일 캔버스를 재사용해 페이지를 순차 렌더 → 추가 (메모리 안전)
  const canvas = document.createElement('canvas');
  canvas.width = PAGE_W;
  canvas.height = PAGE_H;
  const ctx = canvas.getContext('2d');

  let pageNum = 0;
  let y = MARGIN;

  const beginBlankPage = () => {
    pageNum++;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, PAGE_W, PAGE_H);
    ctx.textBaseline = 'alphabetic';
    y = MARGIN;
  };

  const flushPage = () => {
    // 하단 브랜딩(오독오독) + 페이지 번호
    ctx.textAlign = 'center';
    ctx.font = `600 22px ${FONT}`;
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('오독오독', PAGE_W / 2, PAGE_H - MARGIN - 4);
    ctx.font = `400 18px ${FONT}`;
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(String(pageNum), PAGE_W / 2, PAGE_H - MARGIN + 24);

    if (pageNum > 1) pdf.addPage();
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pw, ph);
  };

  const ensureSpace = (h) => {
    if (y + h > BODY_BOTTOM && pageNum < MAX_PAGES) {
      flushPage();
      beginBlankPage();
    }
  };

  const drawWrapped = (text, { size, weight, color, align = 'left', lineGap, gapAfter = 0 }) => {
    const lh = Math.round(size * lineGap);
    ctx.font = `${weight} ${size}px ${FONT}`;
    const lines = wrapText(ctx, text, CONTENT_W);
    for (const line of lines) {
      ensureSpace(lh);
      if (pageNum >= MAX_PAGES && y + lh > BODY_BOTTOM) return; // 안전장치 도달
      ctx.font = `${weight} ${size}px ${FONT}`;
      ctx.fillStyle = color;
      ctx.textAlign = align;
      ctx.fillText(line, align === 'center' ? PAGE_W / 2 : MARGIN, y + size);
      y += lh;
    }
    y += gapAfter;
  };

  beginBlankPage(); // 1페이지 시작

  for (const el of elements) {
    if (pageNum >= MAX_PAGES && y + 40 > BODY_BOTTOM) break;

    if (el.kind === 'title') {
      drawWrapped(el.text, { size: 52, weight: '700', color: '#1e293b', align: 'center', lineGap: 1.35, gapAfter: 14 });
    } else if (el.kind === 'author') {
      drawWrapped(el.text, { size: 26, weight: '400', color: '#64748b', align: 'center', lineGap: 1.4, gapAfter: 30 });
      // 구분선
      ensureSpace(60);
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(PAGE_W / 2 - 90, y);
      ctx.lineTo(PAGE_W / 2 + 90, y);
      ctx.stroke();
      y += 56;
    } else if (el.kind === 'heading') {
      y += 24;
      drawWrapped(el.text, { size: 34, weight: '700', color: '#0f172a', align: 'left', lineGap: 1.4, gapAfter: 16 });
    } else {
      drawWrapped(el.text, { size: 30, weight: '400', color: '#1f2937', align: 'left', lineGap: 1.62, gapAfter: 20 });
    }
  }

  flushPage(); // 마지막 페이지 마무리

  const fileName = safeFileName(book.title);

  if (Capacitor.isNativePlatform()) {
    const blob = pdf.output('blob');
    const base64 = await blobToBase64(blob);
    const res = await Filesystem.writeFile({
      path: fileName,
      data: base64,
      directory: Directory.Cache,
    });
    await Share.share({
      title: book.title || '오독오독',
      files: [res.uri],
      dialogTitle: '책 PDF 저장 / 공유',
    });
  } else {
    pdf.save(fileName);
  }

  return { pages: pageNum };
}

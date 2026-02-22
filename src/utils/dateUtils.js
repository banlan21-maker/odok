// src/utils/dateUtils.js
// 날짜 포맷팅 유틸리티 함수

/**
 * Firestore Timestamp 또는 Date 객체를 한국어 형식의 날짜 문자열로 변환
 * @param {any} dateValue - Firestore Timestamp, Date 객체, 또는 날짜 관련 값
 * @returns {string} 포맷팅된 날짜 문자열
 */
const parseDateValue = (dateValue) => {
  if (!dateValue) {
    return null;
  }

  if (dateValue?.toDate) {
    return dateValue.toDate();
  }
  if (dateValue?.seconds) {
    return new Date(dateValue.seconds * 1000);
  }
  if (dateValue instanceof Date) {
    return dateValue;
  }
  if (typeof dateValue === 'string') {
    return new Date(dateValue);
  }
  if (typeof dateValue === 'number') {
    return dateValue > 1000000000000
      ? new Date(dateValue)
      : new Date(dateValue * 1000);
  }

  return null;
};

const isInvalidDate = (date) => {
  if (!date || isNaN(date.getTime())) {
    return true;
  }
  // 1970-01-02 이전 타임스탬프는 잘못된 값으로 간주
  return date.getTime() < 86400000;
};

/** 1시간(밀리초). 생성일이 이보다 짧으면 "방금 전" 표시 */
const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * 생성일이 1시간 미만이면 "방금 전", 그 외에는 정확한 날짜 표시.
 * 날짜가 없거나 유효하지 않으면 fallbackDateValue(예: dateKey 'YYYY-MM-DD')를 시도.
 * 둘 다 없으면 "날짜 없음".
 */
export const formatDate = (dateValue, fallbackDateValue) => {
  let date = parseDateValue(dateValue);
  if (isInvalidDate(date) && fallbackDateValue) {
    date = parseDateValue(fallbackDateValue);
  }
  if (isInvalidDate(date)) {
    return '날짜 없음';
  }

  const now = Date.now();
  const diff = now - date.getTime();
  if (diff >= 0 && diff < ONE_HOUR_MS) {
    return '방금 전';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}. ${month}. ${day}`;
};

/**
 * 날짜를 상세한 한국어 형식으로 변환 (예: 2026년 1월 9일).
 * 생성일이 1시간 미만이면 "방금 전", 날짜 없/무효면 fallbackDateValue 시도 후 "날짜 없음".
 */
export const formatDateDetailed = (dateValue, fallbackDateValue) => {
  let date = parseDateValue(dateValue);
  if (isInvalidDate(date) && fallbackDateValue) {
    date = parseDateValue(fallbackDateValue);
  }
  if (isInvalidDate(date)) {
    return '날짜 없음';
  }

  const now = Date.now();
  const diff = now - date.getTime();
  if (diff >= 0 && diff < ONE_HOUR_MS) {
    return '방금 전';
  }

  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

/** 오늘 날짜 키 (YYYY-MM-DD). 슬롯/일일 제한 등에 사용 */
export const getTodayDateKey = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

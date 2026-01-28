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
  return date.getTime() < 86400000;
};

export const formatDate = (dateValue) => {
  const date = parseDateValue(dateValue);

  if (isInvalidDate(date)) {
    return '방금 전';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}. ${month}. ${day}`;
};

/**
 * 날짜를 상세한 한국어 형식으로 변환 (예: 2026년 1월 9일)
 * @param {any} dateValue - Firestore Timestamp, Date 객체, 또는 날짜 관련 값
 * @returns {string} 포맷팅된 날짜 문자열
 */
export const formatDateDetailed = (dateValue) => {
  const date = parseDateValue(dateValue);

  if (isInvalidDate(date)) {
    return '방금 전';
  }

  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

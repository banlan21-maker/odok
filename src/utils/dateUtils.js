// src/utils/dateUtils.js
// 날짜 포맷팅 유틸리티 함수

/**
 * Firestore Timestamp 또는 Date 객체를 한국어 형식의 날짜 문자열로 변환
 * @param {any} dateValue - Firestore Timestamp, Date 객체, 또는 날짜 관련 값
 * @returns {string} 포맷팅된 날짜 문자열
 */
export const formatDate = (dateValue) => {
  // null 또는 undefined인 경우 (서버 저장 직후)
  if (!dateValue) {
    return '방금 전';
  }

  let date = null;

  // Firestore Timestamp 객체인 경우
  if (dateValue?.toDate) {
    date = dateValue.toDate();
  }
  // Firestore Timestamp의 seconds 필드가 있는 경우
  else if (dateValue?.seconds) {
    date = new Date(dateValue.seconds * 1000);
  }
  // 일반 Date 객체인 경우
  else if (dateValue instanceof Date) {
    date = dateValue;
  }
  // 문자열인 경우
  else if (typeof dateValue === 'string') {
    date = new Date(dateValue);
  }
  // 숫자 타임스탬프인 경우
  else if (typeof dateValue === 'number') {
    // 밀리초 타임스탬프인 경우 (13자리)
    if (dateValue > 1000000000000) {
      date = new Date(dateValue);
    }
    // 초 단위 타임스탬프인 경우 (10자리)
    else {
      date = new Date(dateValue * 1000);
    }
  }

  // 유효한 날짜인지 확인
  if (!date || isNaN(date.getTime())) {
    return '방금 전';
  }

  // 1970년 1월 1일 이전이면 잘못된 타임스탬프로 간주
  if (date.getTime() < 86400000) { // 1970-01-02 이전
    return '방금 전';
  }

  // 한국어 형식으로 포맷팅 (YYYY. MM. DD)
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
  // null 또는 undefined인 경우
  if (!dateValue) {
    return '방금 전';
  }

  let date = null;

  // Firestore Timestamp 객체인 경우
  if (dateValue?.toDate) {
    date = dateValue.toDate();
  }
  // Firestore Timestamp의 seconds 필드가 있는 경우
  else if (dateValue?.seconds) {
    date = new Date(dateValue.seconds * 1000);
  }
  // 일반 Date 객체인 경우
  else if (dateValue instanceof Date) {
    date = dateValue;
  }
  // 문자열인 경우
  else if (typeof dateValue === 'string') {
    date = new Date(dateValue);
  }
  // 숫자 타임스탬프인 경우
  else if (typeof dateValue === 'number') {
    if (dateValue > 1000000000000) {
      date = new Date(dateValue);
    } else {
      date = new Date(dateValue * 1000);
    }
  }

  // 유효한 날짜인지 확인
  if (!date || isNaN(date.getTime())) {
    return '방금 전';
  }

  // 1970년 1월 1일 이전이면 잘못된 타임스탬프로 간주
  if (date.getTime() < 86400000) {
    return '방금 전';
  }

  // 한국어 형식으로 포맷팅
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

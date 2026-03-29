// src/utils/aiCoverService.js
// 프리미엄 AI 표지 생성 클라이언트 서비스

import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

/**
 * AI 프리미엄 표지 생성
 * Firebase Cloud Function(generateBookCover)을 호출하여
 * Gemini로 이미지를 생성하고 Storage에 저장한 뒤 cover_url을 반환한다.
 *
 * @param {string} bookId
 * @param {string} bookTitle
 * @param {string} bookContent
 * @param {string} appId
 * @returns {Promise<string>} coverUrl
 */
export const generatePremiumCover = async (bookId, bookTitle, bookContent, appId) => {
  const generateBookCoverFn = httpsCallable(functions, 'generateBookCover', {
    timeout: 120000, // 2분
  });

  const result = await generateBookCoverFn({
    bookId,
    bookTitle,
    bookContent: (bookContent || '').substring(0, 1500),
    appId,
  });

  if (!result.data?.coverUrl) {
    throw new Error('표지 URL을 받지 못했습니다.');
  }

  return result.data.coverUrl;
};

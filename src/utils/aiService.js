// src/utils/aiService.js
// AI 생성 로직 통합 서비스

import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

/**
 * AI를 사용하여 책 생성
 * @param {Object} options - 생성 옵션
 * @param {string} options.category - 메인 카테고리 ID
 * @param {string} options.subCategory - 서브 카테고리 ID
 * @param {string} options.genre - 세부 장르
 * @param {string} options.keywords - 주제/키워드
 * @param {boolean} options.isSeries - 시리즈 여부
 * @param {string} options.previousContext - 이전 줄거리 (시리즈 연속 생성 시)
 * @param {string|null} options.endingStyle - 결말 스타일 (소설 전용)
 * @param {string|null} options.title - 사용자 입력 제목
 * @param {string|null} options.selectedTone - 비소설 문체 선택값
 * @param {string|null} options.selectedMood - 소설 분위기 선택값
 * @returns {Promise<{title: string, content: string, summary: string}>}
 */
export const generateBook = async ({ 
  category, 
  subCategory, 
  genre, 
  keywords, 
  isSeries,
  previousContext = null,
  endingStyle = null,
  title = null,
  selectedTone = null,
  selectedMood = null
}) => {
  try {
    const generateBookAI = httpsCallable(functions, 'generateBookAI', {
      timeout: 540000
    });
    
    const result = await generateBookAI({
      category: category,
      subCategory: subCategory,
      genre: genre,
      keywords: keywords || '',
      isSeries: isSeries || false,
      previousContext: previousContext || null,
      endingStyle: endingStyle || null,
      title: title || null,
      selectedTone: selectedTone || null,
      selectedMood: selectedMood || null
    });
    
    const bookData = result.data;

    // 결과 검증
    if (!bookData || !bookData.title || !bookData.content) {
      throw new Error('AI가 올바른 형식의 응답을 반환하지 않았습니다.');
    }

    return {
      title: bookData.title,
      content: bookData.content,
      summary: bookData.summary || bookData.content.substring(0, 100) + '...',
      steps: bookData.steps || [],
      storySummary: bookData.storySummary || '',
      synopsis: bookData.synopsis || '',
      characterSheet: bookData.characterSheet || '',
      settingSheet: bookData.settingSheet || ''
    };
  } catch (error) {
    console.error('[AI Service] 책 생성 오류:', error);
    
    // 에러 메시지 추출
    const errorMessage = error?.message || error?.details?.message || '책 생성에 실패했습니다. 다시 시도해주세요.';
    
    throw new Error(errorMessage);
  }
};

/**
 * 운영자 전용: 책 삭제 (본문 + 댓글·좋아요·즐겨찾기·완독 데이터 함께 삭제)
 */
export const deleteBookAdmin = async ({ appId, bookId }) => {
  try {
    const deleteBookAdminFn = httpsCallable(functions, "deleteBookAdmin");
    await deleteBookAdminFn({ appId, bookId });
    return { success: true };
  } catch (error) {
    console.error("[AI Service] 책 삭제 오류:", error);
    const errorMessage = error?.message || error?.details?.message || "삭제에 실패했습니다.";
    throw new Error(errorMessage);
  }
};

/**
 * 시리즈 다음 화 생성
 */
export const generateSeriesEpisode = async ({
  seriesId,
  category,
  subCategory,
  genre,
  keywords,
  title,
  cumulativeSummary,
  lastEpisodeContent,
  synopsis,
  characterSheet,
  settingSheet,
  continuationType,
  selectedMood,
  endingStyle
}) => {
  try {
    const generateSeriesEpisodeFn = httpsCallable(functions, 'generateSeriesEpisode', {
      timeout: 540000
    });

    const result = await generateSeriesEpisodeFn({
      seriesId,
      category,
      subCategory,
      genre,
      keywords,
      title,
      cumulativeSummary,
      lastEpisodeContent,
      synopsis,
      characterSheet,
      settingSheet,
      continuationType,
      selectedMood,
      endingStyle
    });
    
    const episodeData = result.data;

    if (!episodeData || !episodeData.content) {
      throw new Error('AI가 올바른 형식의 응답을 반환하지 않았습니다.');
    }

    return {
      content: episodeData.content,
      summary: episodeData.summary || '',
      cumulativeSummary: episodeData.cumulativeSummary || cumulativeSummary,
      isFinale: episodeData.isFinale || false
    };
  } catch (error) {
    console.error('[AI Service] 시리즈 이어쓰기 오류:', error);
    
    const errorMessage = error?.message || error?.details?.message || '시리즈 집필에 실패했습니다. 다시 시도해주세요.';
    
    throw new Error(errorMessage);
  }
};

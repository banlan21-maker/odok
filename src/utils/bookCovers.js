// src/utils/bookCovers.js
// 카테고리별 책 표지 이미지 매핑

/**
 * 카테고리에 맞는 표지 이미지 URL 반환
 * @param {string} category - 책의 카테고리 (webnovel, novel, essay, self-improvement, humanities)
 * @param {string} subCategory - 서브 카테고리 (선택적)
 * @returns {string} 이미지 URL
 */
export const getBookCoverImage = (category, subCategory = null) => {
  // 카테고리를 소문자로 정규화
  const normalizedCategory = String(category || '').trim().toLowerCase();

  // Unsplash 이미지 URL 매핑
  const coverImages = {
    // 웹소설/소설: 몽환적인 우주, 판타지 배경, 감성적인 밤하늘
    'webnovel': 'https://images.unsplash.com/photo-1446776653964-20c1d3a81b06?w=400&h=600&fit=crop&auto=format',
    'novel': 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=400&h=600&fit=crop&auto=format',
    
    // 에세이: 따뜻한 커피, 다이어리, 창가, 노을
    'essay': 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?w=400&h=600&fit=crop&auto=format',
    
    // 자기계발: 나침반, 깔끔한 책상, 등대, 시계
    'self-improvement': 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=400&h=600&fit=crop&auto=format',
    
    // 인문/철학: 고대 건축물, 도서관 서가, 생각하는 사람
    'humanities': 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&h=600&fit=crop&auto=format',
    
    // 기본값: 심플한 책 아이콘 배경
    'default': 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=400&h=600&fit=crop&auto=format'
  };

  // 카테고리에 맞는 이미지 반환
  if (coverImages[normalizedCategory]) {
    return coverImages[normalizedCategory];
  }

  // 기본 이미지 반환
  return coverImages['default'];
};

/**
 * 책 객체에서 표지 이미지 URL 가져오기
 * @param {Object} book - 책 객체
 * @returns {string} 이미지 URL
 */
export const getCoverImageFromBook = (book) => {
  if (!book) return getBookCoverImage('default');
  
  return getBookCoverImage(book.category, book.subCategory);
};

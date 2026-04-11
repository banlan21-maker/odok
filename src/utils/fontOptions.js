// src/utils/fontOptions.js
// 책 본문용 폰트 옵션
export const BOOK_FONTS = [
  { id: 'default', label: '기본', family: 'system-ui, sans-serif', preview: '가나다라' },
  { id: 'noto-serif', label: '노토 명조', family: '"Noto Serif KR", serif', preview: '가나다라' },
  { id: 'nanum-myeongjo', label: '나눔 명조', family: '"Nanum Myeongjo", serif', preview: '가나다라' },
  { id: 'noto-sans', label: '노토 고딕', family: '"Noto Sans KR", sans-serif', preview: '가나다라' },
  { id: 'gaegu', label: '개구체', family: '"Gaegu", cursive', preview: '가나다라' },
];

export const getFontFamily = (fontId) => {
  const font = BOOK_FONTS.find(f => f.id === fontId);
  return font?.family || BOOK_FONTS[0].family;
};

/**
 * 장르/카테고리 ID를 한글로 변환
 * 설정이 한글이면 모든 표기를 한글로
 */

const GENRE_ID_TO_KOREAN = {
  // 소설 카테고리
  webnovel: '웹소설',
  novel: '소설',
  series: '시리즈',
  'web-novel': '웹소설',
  fiction: '소설',
  // 비소설 카테고리
  essay: '에세이',
  'self-help': '자기계발',
  'self-improvement': '자기계발',
  humanities: '인문·철학',
  philosophy: '인문·철학',
  // 웹소설 장르
  romance: '로맨스',
  'romance-fantasy': '로맨스 판타지',
  fantasy: '판타지',
  'modern-fantasy': '현대 판타지',
  wuxia: '무협',
  'mystery-horror': '미스터리/공포',
  sf: 'SF',
  // 소설 장르
  drama: '드라마',
  mystery: '미스터리/추리',
  thriller: '스릴러',
  history: '역사',
  healing: '힐링',
  // 비소설 세부 장르
  empathy: '공감위로',
  attitude: '삶의태도',
  relation: '관계',
  alone: '혼자만의 시간',
  habit: '습관·루틴',
  mindset: '마인드셋',
  communication: '인간관계·소통',
  life: '인생정리',
  psychology: '생활형심리',
  philosophy: '이야기철학',
  human: '인간이해',
  thinking: '생각훈련'
};

/**
 * 장르/카테고리 ID를 한글로 변환
 * @param {string} value - 장르 ID (예: wuxia, thriller, sf)
 * @param {string} lang - 'ko' | 'en' (기본 'ko' - 한글 표기)
 * @returns {string} 한글 표기
 */
export function formatGenreTag(value, lang = 'ko') {
  if (!value) return value;
  const normalized = String(value).trim().toLowerCase();
  const korean = GENRE_ID_TO_KOREAN[normalized];
  if (korean) return korean;
  // 매핑 없으면 원문 반환 (이미 한글이면 그대로)
  if (/[가-힣]/.test(value)) return value;
  // 영문만 있으면 한글 매핑 시도 (id에 하이픈 변형)
  const withHyphen = normalized.replace(/_/g, '-');
  if (GENRE_ID_TO_KOREAN[withHyphen]) return GENRE_ID_TO_KOREAN[withHyphen];
  return value;
}

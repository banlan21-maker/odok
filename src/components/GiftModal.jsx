// src/components/GiftModal.jsx
import React, { useState } from 'react';
import { X, Minus, Plus, Droplets } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'odok-app-default';
const appId = rawAppId.replace(/\//g, '_');

const GiftModal = ({ item, follows, userProfile, onClose }) => {
  const [phase, setPhase] = useState('author'); // 'author' | 'qty' | 'sending' | 'done'
  const [selectedAuthor, setSelectedAuthor] = useState(null); // { uid, nickname, profileImageUrl }
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState(null);

  const followedAuthors = Object.entries(follows || {}).map(([uid, data]) => ({
    uid,
    nickname: data.nickname || '익명',
    profileImageUrl: data.profileImageUrl || null,
  }));

  const currentInk = userProfile?.ink ?? 0;
  const totalCost = item.price * quantity;
  const canAfford = currentInk >= totalCost;

  const handleSend = async () => {
    if (!selectedAuthor || !canAfford) return;
    setPhase('sending');
    setError(null);

    const giftFn = httpsCallable(functions, 'giftItem');

    try {
      await giftFn({
        recipientUid: selectedAuthor.uid,
        itemId: item.id,
        quantity,
        appId,
      });
      setPhase('done');
    } catch (err) {
      setError(err.message || '선물 전송에 실패했습니다. 다시 시도해주세요.');
      setPhase('qty');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-t-3xl shadow-2xl max-h-[80vh] flex flex-col">

        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex-none">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎁</span>
            <p className="font-black text-slate-800 dark:text-slate-100">선물하기</p>
            <span className="text-[10px] font-bold text-slate-400">
              {phase === 'author' && '받을 작가 선택'}
              {phase === 'qty' && '수량 선택'}
              {phase === 'sending' && '전송 중...'}
              {phase === 'done' && '완료!'}
            </span>
          </div>
          <button
            onClick={onClose}
            disabled={phase === 'sending'}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 선물 아이템 정보 (항상 표시) */}
        {phase !== 'done' && (
          <div className="px-5 pt-3 pb-0 flex-none">
            <div className="bg-slate-50 dark:bg-slate-700 rounded-xl px-4 py-2.5 flex items-center gap-3">
              <span className="text-2xl">{item.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-slate-800 dark:text-slate-100">{item.name}</p>
                <div className="flex items-center gap-1">
                  <Droplets className="w-3 h-3 text-blue-500 fill-blue-400" />
                  <span className="text-[11px] font-black text-blue-600 dark:text-blue-400">{item.price}개 / 1개</span>
                </div>
              </div>
              {selectedAuthor && phase !== 'author' && (
                <div className="text-right">
                  <p className="text-[10px] text-slate-400">받는 사람</p>
                  <p className="text-xs font-black text-slate-600 dark:text-slate-300 truncate max-w-[80px]">{selectedAuthor.nickname}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto">

          {/* 작가 선택 */}
          {phase === 'author' && (
            <div className="px-5 py-4 space-y-2">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
                선물 받을 팔로우 작가를 선택하세요
              </p>
              {followedAuthors.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <p className="text-4xl">👤</p>
                  <p className="text-sm font-bold text-slate-600 dark:text-slate-300">팔로우한 작가가 없습니다.</p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    다른 작가의 책 상세에서 팔로우한 후<br />선물을 보내보세요!
                  </p>
                </div>
              ) : (
                followedAuthors.map(author => (
                  <button
                    key={author.uid}
                    onClick={() => { setSelectedAuthor(author); setQuantity(1); setError(null); setPhase('qty'); }}
                    className="w-full flex items-center gap-3 bg-slate-50 dark:bg-slate-700 rounded-xl px-4 py-3 hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-200 to-pink-200 dark:from-orange-800 dark:to-pink-900 flex items-center justify-center shrink-0 text-sm font-black text-orange-700 dark:text-orange-300">
                      {author.nickname.charAt(0)}
                    </div>
                    <p className="text-sm font-black text-slate-800 dark:text-slate-100 flex-1 truncate">
                      {author.nickname}
                    </p>
                    <span className="text-xs text-slate-400 dark:text-slate-500">선택</span>
                  </button>
                ))
              )}
            </div>
          )}

          {/* 수량 선택 */}
          {phase === 'qty' && (
            <div className="px-5 py-4 space-y-4">
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">몇 개를 선물하시겠습니까?</p>
                <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-3 flex items-center justify-between">
                  <button
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    className="w-9 h-9 rounded-full bg-white dark:bg-slate-600 border border-slate-200 dark:border-slate-500 flex items-center justify-center text-slate-600 dark:text-slate-300 active:scale-95"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-2xl font-black text-slate-800 dark:text-slate-100 w-12 text-center">{quantity}</span>
                  <button
                    onClick={() => setQuantity(q => Math.min(q + 1, 10))}
                    className="w-9 h-9 rounded-full bg-orange-500 flex items-center justify-center text-white active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 총 비용 */}
              <div className="bg-slate-50 dark:bg-slate-700 rounded-xl px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-600 dark:text-slate-300">총 금액</span>
                <div className="flex items-center gap-1.5">
                  <Droplets className="w-4 h-4 text-blue-500 fill-blue-400" />
                  <span className={`text-base font-black ${canAfford ? 'text-blue-600 dark:text-blue-400' : 'text-red-500'}`}>
                    {totalCost}개
                  </span>
                  <span className="text-xs text-slate-400">(보유 {currentInk}개)</span>
                </div>
              </div>

              {error && <p className="text-xs text-red-500 font-bold text-center">{error}</p>}
            </div>
          )}

          {/* 전송 중 */}
          {phase === 'sending' && (
            <div className="px-5 py-14 text-center space-y-5">
              <span className="text-6xl animate-bounce inline-block">🎁</span>
              <div className="space-y-1.5">
                <p className="text-sm font-black text-slate-700 dark:text-slate-200">선물을 전달하는 중...</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {selectedAuthor?.nickname}님에게 {item.name} {quantity}개
                </p>
              </div>
            </div>
          )}

          {/* 완료 */}
          {phase === 'done' && (
            <div className="px-5 py-10 text-center space-y-4">
              <div className="relative">
                <span className="text-7xl">🎁</span>
                <span className="absolute -top-1 -right-1 text-3xl animate-bounce">✨</span>
              </div>
              <div className="space-y-1.5">
                <p className="text-base font-black text-slate-800 dark:text-slate-100">선물 완료!</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  <span className="font-bold text-orange-500">{selectedAuthor?.nickname}</span>님에게<br />
                  <span className="font-bold text-slate-700 dark:text-slate-200">{item.emoji} {item.name} {quantity}개</span>를<br />
                  선물했습니다 🎉
                </p>
              </div>
              <div className="bg-orange-50 dark:bg-orange-950/30 rounded-xl px-4 py-3">
                <div className="flex items-center justify-center gap-1.5">
                  <Droplets className="w-4 h-4 text-blue-500 fill-blue-400" />
                  <span className="text-xs font-black text-blue-600 dark:text-blue-400">
                    {totalCost}개 차감 완료
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        <div className="px-5 pb-10 pt-3 flex-none border-t border-slate-100 dark:border-slate-700">
          {phase === 'author' && followedAuthors.length === 0 && (
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl text-sm font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
            >
              닫기
            </button>
          )}
          {phase === 'qty' && (
            <div className="space-y-2">
              <button
                onClick={handleSend}
                disabled={!canAfford}
                className="w-full py-3.5 rounded-xl text-sm font-black bg-orange-500 hover:bg-orange-600 active:scale-95 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {canAfford
                  ? `🎁 ${selectedAuthor?.nickname}님께 선물하기`
                  : '잉크가 부족합니다'}
              </button>
              <button
                onClick={() => { setPhase('author'); setSelectedAuthor(null); }}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-slate-400 dark:text-slate-500"
              >
                ← 작가 다시 선택
              </button>
            </div>
          )}
          {phase === 'done' && (
            <button
              onClick={onClose}
              className="w-full py-3.5 rounded-xl text-sm font-black bg-orange-500 text-white"
            >
              확인
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default GiftModal;

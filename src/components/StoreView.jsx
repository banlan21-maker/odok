// src/components/StoreView.jsx
import React, { useState } from 'react';
import { Droplets, Minus, Plus, X, CheckCircle, Video } from 'lucide-react';
import { STORE_ITEMS } from '../hooks/useInventory';
import { showRewardVideoAd } from '../utils/admobService';

const StoreView = ({ userProfile, purchaseItem, isPurchasing, getItemQuantity, onGiftItem, addInk }) => {
  const [selectedItem, setSelectedItem] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [phase, setPhase] = useState('select'); // 'select' | 'confirm' | 'done'
  const [error, setError] = useState(null);
  const [isCharging, setIsCharging] = useState(false);
  const [chargeSuccess, setChargeSuccess] = useState(false);

  const handleChargeInk = () => {
    if (isCharging || !addInk) return;
    setIsCharging(true);
    showRewardVideoAd(
      async () => {
        const success = await addInk(10);
        if (success) { setChargeSuccess(true); setTimeout(() => setChargeSuccess(false), 2500); }
        setIsCharging(false);
      },
      () => { setIsCharging(false); }
    );
  };

  const currentInk = userProfile?.ink ?? 0;

  const openPurchaseModal = (item) => {
    setSelectedItem(item);
    setQuantity(1);
    setPhase('select');
    setError(null);
  };

  const closeModal = () => {
    setSelectedItem(null);
    setPhase('select');
    setError(null);
  };

  const handleConfirm = () => {
    if (!selectedItem) return;
    const totalCost = selectedItem.price * quantity;
    if (currentInk < totalCost) {
      setError(`잉크가 부족해요! (보유: ${currentInk}개, 필요: ${totalCost}개)`);
      return;
    }
    setError(null);
    setPhase('confirm');
  };

  const handlePurchase = async () => {
    if (!selectedItem) return;
    const result = await purchaseItem(selectedItem.id, quantity);
    if (result.success) {
      setPhase('done');
    } else {
      setError(result.error || '구매에 실패했습니다.');
      setPhase('select');
    }
  };

  const totalCost = selectedItem ? selectedItem.price * quantity : 0;
  const canAfford = currentInk >= totalCost;

  return (
    <div className="bg-slate-50 dark:bg-slate-900 min-h-full">
      <div className="px-5 pt-5 pb-8 space-y-4">

        {/* 광고 보고 잉크 얻기 */}
        <button
          onClick={handleChargeInk}
          disabled={isCharging}
          className={`w-full py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all ${
            isCharging ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
            : chargeSuccess ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
            : 'bg-blue-500 hover:bg-blue-600 active:scale-95 text-white'
          }`}
        >
          {isCharging ? <span className="animate-pulse">광고 로딩 중...</span>
          : chargeSuccess ? <><Droplets className="w-4 h-4" /><span>+10 충전 완료!</span></>
          : <><Video className="w-4 h-4" /><span>광고 보고 잉크 얻기 (+10)</span></>}
        </button>

        {/* 아이템 목록 */}
        <div className="space-y-2.5">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 px-1">판매 중인 아이템</p>

          {STORE_ITEMS.map((item) => {
            const owned = getItemQuantity(item.id);
            return (
              <div
                key={item.id}
                className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center text-2xl shrink-0">
                    {item.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-black text-slate-800 dark:text-slate-100">{item.name}</p>
                      {owned > 0 && (
                        <span className="text-[10px] font-black text-orange-600 bg-orange-50 dark:bg-orange-950/40 px-2 py-0.5 rounded-full">
                          보유 {owned}개
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 leading-relaxed">{item.description}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                  <div className="flex items-center gap-1">
                    <Droplets className="w-3.5 h-3.5 text-blue-500 fill-blue-400" />
                    <span className="text-sm font-black text-blue-600 dark:text-blue-400">{item.price}개</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onGiftItem?.(item)}
                      className="px-3 py-1.5 rounded-xl text-xs font-black border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95 transition-all"
                      title="팔로우한 작가에게 선물하기"
                    >
                      🎁 선물
                    </button>
                    <button
                      onClick={() => openPurchaseModal(item)}
                      className="px-5 py-1.5 rounded-xl text-xs font-black bg-orange-500 hover:bg-orange-600 active:scale-95 text-white transition-all"
                    >
                      구매하기
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 안내 */}
        <div className="bg-white dark:bg-slate-800 rounded-xl px-4 py-3 border border-dashed border-slate-200 dark:border-slate-600 text-center">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            💡 구매한 아이템은 <span className="font-bold text-slate-500 dark:text-slate-400">글쓰기 에디터</span>에서 사용할 수 있어요
          </p>
        </div>
      </div>

      {/* 구매 모달 */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-t-3xl p-6 pb-10 shadow-2xl">

            {/* 헤더 */}
            <div className="flex justify-between items-center mb-5">
              <p className="font-black text-slate-800 dark:text-slate-100">
                {phase === 'done' ? '🎉 구매 완료!' : `${selectedItem.emoji} ${selectedItem.name}`}
              </p>
              <button onClick={closeModal} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 완료 */}
            {phase === 'done' && (
              <div className="text-center py-4 space-y-3">
                <CheckCircle className="w-14 h-14 text-emerald-500 mx-auto" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  {selectedItem.name} {quantity}개를 구매했습니다!
                </p>
                <p className="text-xs text-slate-400">글쓰기 에디터에서 사용해보세요 ✏️</p>
                <button
                  onClick={closeModal}
                  className="w-full py-3 rounded-xl text-sm font-black bg-orange-500 text-white"
                >
                  확인
                </button>
              </div>
            )}

            {/* 최종 확인 */}
            {phase === 'confirm' && (
              <div className="space-y-4">
                <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4 text-center">
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    {selectedItem.emoji} {selectedItem.name} {quantity}개
                  </p>
                  <div className="flex items-center justify-center gap-1.5 mt-1">
                    <Droplets className="w-4 h-4 text-blue-500 fill-blue-400" />
                    <span className="text-lg font-black text-blue-600 dark:text-blue-400">{totalCost}개 차감</span>
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                  총 {totalCost}잉크로 구매하시겠습니까?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPhase('select')}
                    className="flex-1 py-3 rounded-xl text-sm font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                  >
                    돌아가기
                  </button>
                  <button
                    onClick={handlePurchase}
                    disabled={isPurchasing}
                    className="flex-1 py-3 rounded-xl text-sm font-black bg-orange-500 text-white disabled:opacity-60"
                  >
                    {isPurchasing ? '처리 중...' : '구매 확정'}
                  </button>
                </div>
              </div>
            )}

            {/* 수량 선택 */}
            {phase === 'select' && (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">몇 개를 구매하시겠습니까?</p>
                  <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-3 flex items-center justify-between">
                    <button
                      onClick={() => setQuantity(q => Math.max(1, q - 1))}
                      className="w-9 h-9 rounded-full bg-white dark:bg-slate-600 border border-slate-200 dark:border-slate-500 flex items-center justify-center text-slate-600 dark:text-slate-300 active:scale-95"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="text-2xl font-black text-slate-800 dark:text-slate-100 w-12 text-center">{quantity}</span>
                    <button
                      onClick={() => setQuantity(q => q + 1)}
                      className="w-9 h-9 rounded-full bg-orange-500 flex items-center justify-center text-white active:scale-95"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* 총 금액 */}
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

                {error && (
                  <p className="text-xs text-red-500 font-bold text-center">{error}</p>
                )}

                <button
                  onClick={handleConfirm}
                  disabled={!canAfford}
                  className="w-full py-3.5 rounded-xl text-sm font-black bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  {canAfford ? `${totalCost}잉크로 구매하기` : '잉크가 부족합니다'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StoreView;

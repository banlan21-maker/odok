// src/components/BagModal.jsx
import React from 'react';
import { X } from 'lucide-react';
import { STORE_ITEMS } from '../hooks/useInventory';

const BagModal = ({ inventory, onClose, onUseItem, t = {} }) => {
  const ownedItems = STORE_ITEMS.filter(item => (inventory[item.id] ?? 0) > 0);
  const isEmpty = ownedItems.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-t-3xl shadow-2xl">

        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎒</span>
            <p className="font-black text-slate-800 dark:text-slate-100">{t.bag_title || '내 가방'}</p>
            {!isEmpty && (
              <span className="text-[10px] font-black text-orange-600 bg-orange-50 dark:bg-orange-950/40 px-2 py-0.5 rounded-full">
                {(t.bag_owned_count || '{count}개 보유').replace('{count}', ownedItems.reduce((sum, i) => sum + (inventory[i.id] ?? 0), 0))}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 내용 */}
        <div className="px-5 py-4">
          {isEmpty ? (
            <div className="text-center py-8 space-y-2">
              <p className="text-4xl">👜</p>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{t.bag_empty_title || '아직 가방이 비어있습니다.'}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
                {t.bag_empty_desc || '문방구에서 아이템을 구매해 보세요!'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {ownedItems.map(item => {
                const qty = inventory[item.id] ?? 0;
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 bg-slate-50 dark:bg-slate-700 rounded-xl px-4 py-3"
                  >
                    <span className="text-2xl">{item.emoji}</span>
                    <div className="flex-1">
                      <p className="text-sm font-black text-slate-800 dark:text-slate-100">{item.name}</p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500">{t.bag_item_usable || '글쓰기 에디터에서 사용 가능'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-orange-600 bg-orange-50 dark:bg-orange-950/40 px-3 py-1 rounded-full">
                        {qty}{t.bag_qty_suffix ?? '개'}
                      </span>
                      {item.id === 'sharp' ? (
                        <span className="text-[10px] font-bold text-sky-500 bg-sky-50 dark:bg-sky-950/40 px-2.5 py-1 rounded-full">
                          {t.bag_sharp_usable || '책 미리보기에서 사용'}
                        </span>
                      ) : item.id === 'megaphone' ? (
                        <button
                          onClick={() => { onClose(); onUseItem?.('megaphone'); }}
                          className="text-xs font-black px-3 py-1 rounded-full transition-colors text-violet-600 bg-violet-50 dark:bg-violet-950/40 hover:bg-violet-100 dark:hover:bg-violet-900/50"
                        >
                          {t.bag_use_btn || '사용하기'}
                        </button>
                      ) : (item.id === 'rainbow_ink' || item.id === 'magic_eraser' || item.id === 'golden_pen' || item.id === 'paint_brush') && (
                        <button
                          onClick={() => { onClose(); onUseItem?.(item.id); }}
                          className={`text-xs font-black px-3 py-1 rounded-full transition-colors ${
                            item.id === 'rainbow_ink'
                              ? 'text-violet-600 bg-violet-50 dark:bg-violet-950/40 hover:bg-violet-100 dark:hover:bg-violet-900/50'
                              : item.id === 'magic_eraser'
                              ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
                              : item.id === 'golden_pen'
                              ? 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50'
                              : 'text-pink-600 bg-pink-50 dark:bg-pink-950/40 hover:bg-pink-100 dark:hover:bg-pink-900/50'
                          }`}
                        >
                          {t.bag_use_btn || '사용하기'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 안내 */}
        <div className="px-5 pb-10">
          <div className="bg-slate-50 dark:bg-slate-700 rounded-xl px-4 py-3 text-center">
            <p className="text-xs text-slate-400 dark:text-slate-500">
              ✏️ {t.bag_footer || '아이템은 글쓰기 에디터에서 사용할 수 있습니다'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BagModal;

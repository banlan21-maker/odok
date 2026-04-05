// src/components/MailboxModal.jsx
import React, { useState } from 'react';
import { X, Droplets, Package, CheckCircle, Loader } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'odok-app-default';
const appId = rawAppId.replace(/\//g, '_');

const ITEM_EMOJI = {
  golden_pen: '🖊️',
  rainbow_ink: '🌈',
  magic_eraser: '✨',
  paint_brush: '🎨',
  sharp: '✏️',
};

const MailboxModal = ({ mailboxItems = [], onClose, t = {} }) => {
  const [claimingId, setClaimingId] = useState(null); // 단건 처리 중인 id
  const [claimingAll, setClaimingAll] = useState(false);
  const [claimedIds, setClaimedIds] = useState(new Set());
  const [error, setError] = useState(null);

  const claimFn = httpsCallable(functions, 'claimMailbox');

  const visibleItems = mailboxItems.filter(item => !claimedIds.has(item.id));

  const handleClaim = async (mailboxId) => {
    if (claimingId || claimingAll) return;
    setClaimingId(mailboxId);
    setError(null);
    try {
      await claimFn({ mailboxId, appId });
      setClaimedIds(prev => new Set([...prev, mailboxId]));
    } catch (err) {
      setError(err.message || '수령에 실패했습니다.');
    } finally {
      setClaimingId(null);
    }
  };

  const handleClaimAll = async () => {
    if (claimingId || claimingAll || visibleItems.length === 0) return;
    setClaimingAll(true);
    setError(null);
    try {
      await claimFn({ mailboxId: null, appId });
      setClaimedIds(prev => new Set([...prev, ...visibleItems.map(i => i.id)]));
    } catch (err) {
      setError(err.message || '수령에 실패했습니다.');
    } finally {
      setClaimingAll(false);
    }
  };

  const formatDate = (createdAt) => {
    if (!createdAt) return '';
    const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
    return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      <style>{`
        @keyframes mailbox-slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0); opacity: 1; }
        }
        .mailbox-sheet { animation: mailbox-slide-up 0.3s cubic-bezier(0.32,0.72,0,1) both; }
      `}</style>

      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="mailbox-sheet w-full max-w-sm bg-white dark:bg-slate-800 rounded-t-3xl shadow-2xl max-h-[80vh] flex flex-col">

          {/* 헤더 */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-none">
            <div className="flex items-center gap-2">
              <span className="text-xl">📬</span>
              <h2 className="text-base font-black text-slate-800 dark:text-slate-100">
                {t.mailbox_title || '우편함'}
              </h2>
              {visibleItems.length > 0 && (
                <span className="text-xs font-black text-white bg-orange-500 px-2 py-0.5 rounded-full">
                  {visibleItems.length}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 에러 */}
          {error && (
            <p className="text-xs text-red-500 font-bold text-center px-5 pb-2">{error}</p>
          )}

          {/* 목록 */}
          <div className="flex-1 overflow-y-auto px-5 pb-2 space-y-2">
            {visibleItems.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <span className="text-5xl">📭</span>
                <p className="text-sm font-bold text-slate-400 dark:text-slate-500">
                  {t.mailbox_empty || '받은 선물이 없습니다'}
                </p>
              </div>
            ) : (
              visibleItems.map((item) => {
                const isClaiming = claimingId === item.id;
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 bg-slate-50 dark:bg-slate-700 rounded-2xl px-4 py-3"
                  >
                    {/* 아이콘 */}
                    <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-600 flex items-center justify-center shrink-0 shadow-sm text-xl">
                      {item.type === 'ink'
                        ? '💧'
                        : (ITEM_EMOJI[item.itemId] || '🎁')}
                    </div>

                    {/* 내용 */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-slate-800 dark:text-slate-100 truncate">
                        {item.type === 'ink'
                          ? `잉크 ${item.quantity}개`
                          : `${item.itemName || item.itemId} ${item.quantity}개`}
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                        {item.senderName || '누군가'}님이 보냄 · {formatDate(item.createdAt)}
                      </p>
                    </div>

                    {/* 받기 버튼 */}
                    <button
                      onClick={() => handleClaim(item.id)}
                      disabled={!!claimingId || claimingAll}
                      className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-black bg-orange-500 text-white active:scale-95 transition-all disabled:opacity-50"
                    >
                      {isClaiming
                        ? <Loader className="w-3.5 h-3.5 animate-spin" />
                        : (t.mailbox_claim || '받기')}
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* 하단 버튼 */}
          <div className="px-5 pb-10 pt-3 flex-none border-t border-slate-100 dark:border-slate-700">
            {visibleItems.length > 1 && (
              <button
                onClick={handleClaimAll}
                disabled={claimingAll || !!claimingId}
                className="w-full py-3.5 rounded-xl text-sm font-black bg-gradient-to-r from-orange-500 to-pink-500 text-white flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 shadow-md shadow-orange-200 dark:shadow-orange-900/30"
              >
                {claimingAll
                  ? <><Loader className="w-4 h-4 animate-spin" /> 수령 중...</>
                  : <><CheckCircle className="w-4 h-4" /> {t.mailbox_claim_all || '모두 받기'} ({visibleItems.length})</>}
              </button>
            )}
            {visibleItems.length === 0 && (
              <button
                onClick={onClose}
                className="w-full py-3 rounded-xl text-sm font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
              >
                {t.close || '닫기'}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default MailboxModal;

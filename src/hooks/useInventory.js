// src/hooks/useInventory.js
import { useState } from 'react';
import { doc, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';

const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'odok-app-default';
const appId = rawAppId.replace(/\//g, '_');

export const STORE_ITEMS = [
  {
    id: 'golden_pen',
    name: '황금만년필',
    emoji: '🖋️',
    description: '작품의 문학적 완성도를 결정적으로 끌어올리는 프리미엄 보정 도구.',
    price: 15,
    color: 'from-amber-50 to-yellow-50',
    border: 'border-amber-200',
    badge: 'bg-amber-100 text-amber-700',
  },
  {
    id: 'rainbow_ink',
    name: '무지개 잉크',
    emoji: '🌈',
    description: '일곱 빛깔 감성이 담긴 잉크. 글에 색다른 분위기를 불어넣어 줘요.',
    price: 10,
    color: 'from-violet-50 to-pink-50',
    border: 'border-violet-200',
    badge: 'bg-violet-100 text-violet-700',
  },
  {
    id: 'magic_eraser',
    name: '마법 지우개',
    emoji: '🪄',
    description: '실수한 글자도 말끔하게. 흔적 없이 지워주는 마법의 지우개예요.',
    price: 10,
    color: 'from-emerald-50 to-teal-50',
    border: 'border-emerald-200',
    badge: 'bg-emerald-100 text-emerald-700',
  },
  {
    id: 'paint_brush',
    name: '페인트붓',
    emoji: '🖌️',
    description: '소설의 분위기에 딱 맞는 AI 표지 이미지를 새롭게 생성합니다.',
    price: 50,
    color: 'from-pink-50 to-rose-50',
    border: 'border-pink-200',
    badge: 'bg-pink-100 text-pink-700',
  },
  {
    id: 'sharp',
    name: '샤프',
    emoji: '✏️',
    description: '독자의 시선을 사로잡는 매력적인 소개글을 AI가 작성해 드립니다.',
    price: 10,
    color: 'from-sky-50 to-cyan-50',
    border: 'border-sky-200',
    badge: 'bg-sky-100 text-sky-700',
  },
  {
    id: 'megaphone',
    name: '확성기',
    emoji: '📢',
    description: '내 책을 홈 화면 프리미엄 홍보 보드에 24시간 노출합니다.',
    price: 10,
    color: 'from-violet-50 to-purple-50',
    border: 'border-violet-200',
    badge: 'bg-violet-100 text-violet-700',
  },
];

export const useInventory = ({ user, userProfile }) => {
  const [isPurchasing, setIsPurchasing] = useState(false);

  const purchaseItem = async (itemId, quantity) => {
    if (!user || !userProfile) return { success: false, error: '로그인이 필요합니다.' };

    const item = STORE_ITEMS.find(i => i.id === itemId);
    if (!item) return { success: false, error: '아이템을 찾을 수 없습니다.' };

    const totalCost = item.price * quantity;
    const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');

    setIsPurchasing(true);
    try {
      await runTransaction(db, async (transaction) => {
        const profileSnap = await transaction.get(profileRef);
        if (!profileSnap.exists()) throw new Error('프로필을 찾을 수 없습니다.');

        const data = profileSnap.data();
        const currentInk = data.ink ?? 0;

        if (currentInk < totalCost) throw new Error('잉크가 부족합니다.');

        const currentQty = data.inventory?.[itemId] ?? 0;
        transaction.update(profileRef, {
          ink: currentInk - totalCost,
          [`inventory.${itemId}`]: currentQty + quantity,
        });
      });

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    } finally {
      setIsPurchasing(false);
    }
  };

  const useItem = async (itemId, quantity = 1) => {
    if (!user || !userProfile) return { success: false, error: '로그인이 필요합니다.' };

    const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');
    try {
      await runTransaction(db, async (transaction) => {
        const profileSnap = await transaction.get(profileRef);
        if (!profileSnap.exists()) throw new Error('프로필을 찾을 수 없습니다.');

        const data = profileSnap.data();
        const currentQty = data.inventory?.[itemId] ?? 0;
        if (currentQty < quantity) throw new Error('아이템이 부족합니다.');

        transaction.update(profileRef, {
          [`inventory.${itemId}`]: currentQty - quantity,
        });
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const getInventory = () => userProfile?.inventory ?? {};

  const getItemQuantity = (itemId) => userProfile?.inventory?.[itemId] ?? 0;

  const getTotalItems = () => {
    const inv = userProfile?.inventory ?? {};
    return Object.values(inv).reduce((sum, qty) => sum + (qty || 0), 0);
  };

  return {
    purchaseItem,
    isPurchasing,
    useItem,
    getInventory,
    getItemQuantity,
    getTotalItems,
  };
};

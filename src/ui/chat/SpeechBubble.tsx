import React, { useState, useEffect, useRef } from 'react';
import { audioManager } from '../../audio/AudioManager';

interface SpeechBubbleProps {
  text: string;
  timestamp: number;
  isSelf?: boolean;
  onFinished?: () => void;
}

export const SpeechBubble: React.FC<SpeechBubbleProps> = ({
  text,
  timestamp,
  isSelf = false,
  onFinished,
}) => {
  const [displayedText, setDisplayedText] = useState('');
  const [scrollOffset, setScrollOffset] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const textContentRef = useRef<HTMLDivElement>(null);
  const lastTimestampRef = useRef<number>(timestamp);

  // メッセージが新しくなった時のリセット
  useEffect(() => {
    lastTimestampRef.current = timestamp;
    setDisplayedText('');
    setScrollOffset(0);
    setIsFadingOut(false);
    setIsDone(false);

    if (!text) return;

    let charIndex = 0;
    const fullLength = text.length;

    // 1文字ずつタイプライター表示 (約45ms間隔)
    const typeTimer = setInterval(() => {
      charIndex++;
      const currentSub = text.slice(0, charIndex);
      setDisplayedText(currentSub);

      // 人間が喋っているような優しい会話音
      const lastChar = text[charIndex - 1];
      if (lastChar && lastChar !== ' ' && lastChar !== '　') {
        audioManager.playChatTick();
      }

      // 全文タイプ完了
      if (charIndex >= fullLength) {
        clearInterval(typeTimer);

        // 2行以上の長文かチェックしてスクロール開始
        setTimeout(() => {
          checkAndScrollContent();
        }, 400);
      }
    }, 45);

    return () => {
      clearInterval(typeTimer);
    };
  }, [text, timestamp]);

  // 長文の垂直スクロールアニメーション & 10秒待機フェードアウト
  const checkAndScrollContent = () => {
    if (!containerRef.current || !textContentRef.current) {
      start10sTimer();
      return;
    }

    const containerHeight = containerRef.current.clientHeight; // 約38px (2行分)
    const totalHeight = textContentRef.current.scrollHeight;

    if (totalHeight <= containerHeight + 4) {
      // 2行以内に収まっている場合: そのまま10秒待ってフェードアウト
      start10sTimer();
      return;
    }

    // 2行を超える長文の場合: ゆっくり上へスクロール
    const maxScroll = totalHeight - containerHeight;
    let currentScroll = 0;
    const scrollSpeed = 0.5; // ゆっくり読みやすいスクロール速度

    const scrollInterval = setInterval(() => {
      currentScroll += scrollSpeed;
      if (currentScroll >= maxScroll) {
        setScrollOffset(maxScroll);
        clearInterval(scrollInterval);
        // 全文がスクロールされ終えたら、ここから10秒間表示を維持！
        start10sTimer();
      } else {
        setScrollOffset(currentScroll);
      }
    }, 30);
  };

  // 全文が読める状態になってから10秒後にフェードアウト
  const start10sTimer = () => {
    setTimeout(() => {
      setIsFadingOut(true);
      setTimeout(() => {
        setIsDone(true);
        onFinished?.();
      }, 600); // 0.6sフェードアニメーション完了後に消去
    }, 10000); // 10秒間表示を維持
  };

  if (isDone || !text) {
    return null;
  }

  const borderColor = isSelf ? 'border-cyan-400/80 shadow-cyan-500/30' : 'border-amber-400/80 shadow-amber-500/30';
  const notchColor = isSelf ? 'border-cyan-400/80' : 'border-amber-400/80';
  const textColor = isSelf ? 'text-cyan-100' : 'text-amber-100';

  return (
    <div
      className={`relative pointer-events-none transition-all duration-500 ease-out ${
        isFadingOut ? 'opacity-0 -translate-y-2 scale-95' : 'opacity-100 translate-y-0 scale-100'
      }`}
    >
      {/* フキダシカプセル (最大2行・横幅最大240pxで画面を圧迫しない) */}
      <div
        className={`glass-panel px-3.5 py-1.5 rounded-2xl border ${borderColor} shadow-2xl backdrop-blur-md max-w-[220px] sm:max-w-[250px] min-w-[70px] text-center`}
      >
        {/* 2行分の高さに制限し、溢れた文字は上へスムーズスクロール */}
        <div
          ref={containerRef}
          className="max-h-[38px] overflow-hidden leading-[19px] relative select-none"
        >
          <div
            ref={textContentRef}
            className={`text-xs font-semibold ${textColor} break-words whitespace-pre-wrap transition-transform duration-75`}
            style={{
              transform: `translateY(-${scrollOffset}px)`,
            }}
          >
            {displayedText}
            {/* タイピング中のカーソル点滅 */}
            {displayedText.length < text.length && (
              <span className="inline-block w-1 h-3 bg-cyan-400 ml-0.5 animate-pulse align-middle" />
            )}
          </div>
        </div>
      </div>

      {/* フキダシのしっぽ（下向き三角ノッチ） */}
      <div
        className={`w-2.5 h-2.5 bg-slate-950 border-r border-b ${notchColor} rotate-45 mx-auto -mt-1.5 shadow-lg`}
      />
    </div>
  );
};

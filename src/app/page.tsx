"use client";

import React, { useState, useCallback, useEffect } from "react";
import {
  DndContext,
  useDraggable,
  useDroppable,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  UniqueIdentifier,
  useSensor,
  useSensors,
  PointerSensor,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { motion, AnimatePresence } from "framer-motion";

// 카드 데이터 타입 정의
interface Card {
  id: string;
  content: string;
  isFlipped: boolean;
  isBomb: boolean;
}

/**
 * 카드 앞면 컴포넌트
 */
const CardFront = ({ content }: { content: string }) => (
  <div
    className="w-24 h-24 bg-blue-500 text-white flex items-center justify-center cursor-pointer rounded-lg shadow-md absolute backface-hidden"
  >
    <div className="text-center font-bold">{content}</div>
  </div>
);

/**
 * 카드 뒷면 컴포넌트
 */
const CardBack = ({ isBomb }: { isBomb: boolean }) => (
  <div
    className={`w-24 h-24 ${isBomb ? 'bg-red-500' : 'bg-gray-700'} text-white flex items-center justify-center cursor-pointer rounded-lg shadow-md absolute backface-hidden`}
    style={{ transform: 'rotateY(180deg)' }}
  >
    <div className="text-center">
      {isBomb ? (
        <div className="flex flex-col items-center">
          <span className="text-2xl">💣</span>
          <span className="text-xs mt-1">폭탄!</span>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <span className="text-xl">✓</span>
          <span className="text-xs mt-1">없음</span>
        </div>
      )}
    </div>
  </div>
);

/**
 * 드래그 가능한 카드 컴포넌트
 */
const DraggableCard = ({
  card,
  isDragging,
  onFlip,
  index
}: {
  card: Card;
  isDragging: boolean;
  onFlip: (id: string) => void;
  index: number;
}) => {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: card.id,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFlip(card.id);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`${isDragging ? "z-10" : ""}`}
    >
      <div 
        className="relative w-24 h-24 preserve-3d"
        onClick={handleClick}
        style={{ 
          transition: 'transform 0.6s',
          transform: card.isFlipped ? 'rotateY(180deg)' : ''
        }}
      >
        <CardFront content={`${card.content}`} />
        <CardBack isBomb={card.isBomb} />
      </div>
    </div>
  );
};

/**
 * 드롭 영역 컴포넌트
 */
const DropArea = ({
  id,
  isActive,
  isOver,
  children,
}: {
  id: string;
  isActive: boolean;
  isOver: boolean;
  children: React.ReactNode;
}) => {
  const { setNodeRef, isOver: dropIsOver } = useDroppable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`w-28 h-28 flex items-center justify-center transition-all duration-200 rounded-lg
        ${isOver || dropIsOver ? "bg-gray-100 scale-105" : ""}`}
    >
      {children}
    </div>
  );
};

export default function Page() {
  const [mounted, setMounted] = useState(false);
  const [cards, setCards] = useState<Card[]>([]);
  const [bombFound, setBombFound] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [flippedCount, setFlippedCount] = useState(0);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  
  // 게임 초기화
  useEffect(() => {
    initGame();
    setMounted(true);
  }, []);
  
  const initGame = () => {
    const randomBombIndex = Math.floor(Math.random() * 9);
    
    const newCards = Array(9).fill(null).map((_, index) => ({
      id: `card-${index + 1}`,
      content: `${index + 1}`,
      isFlipped: false,
      isBomb: index === randomBombIndex
    }));
    
    setCards(newCards);
    setBombFound(false);
    setGameOver(false);
    setFlippedCount(0);
  };
  
  // 카드 뒤집기 핸들러
  const handleFlip = useCallback((id: string) => {
    if (gameOver) return;
    
    setCards(prevCards => {
      const newCards = [...prevCards];
      const cardIndex = newCards.findIndex(c => c.id === id);
      
      if (cardIndex === -1 || newCards[cardIndex].isFlipped) return prevCards;
      
      newCards[cardIndex] = {
        ...newCards[cardIndex],
        isFlipped: true
      };
      
      // 폭탄 체크
      if (newCards[cardIndex].isBomb) {
        setBombFound(true);
        setGameOver(true);
      } else {
        const newFlippedCount = flippedCount + 1;
        setFlippedCount(newFlippedCount);
        
        if (newFlippedCount === 8) {
          setGameOver(true);
        }
      }
      
      return newCards;
    });
  }, [gameOver, flippedCount]);
  
  // 드래그 관련 핸들러
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10,
      },
    })
  );
  
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const cardId = active.id as string;
    const cardIndex = cards.findIndex(c => c.id === cardId);
    
    if (cardIndex === -1 || cards[cardIndex].isFlipped || gameOver) {
      return;
    }
    
    setActiveId(cardId);
  };
  
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    setActiveId(null);
    
    if (!over) return;
    
    const activeId = active.id as string;
    const overId = over.id as string;
    
    if (activeId === overId) return;
    
    setCards(prevCards => {
      const newCards = [...prevCards];
      
      const activeIndex = newCards.findIndex(c => c.id === activeId);
      const overIndex = newCards.findIndex(c => c.id === overId);
      
      if (
        activeIndex === -1 || 
        overIndex === -1 || 
        newCards[activeIndex].isFlipped || 
        newCards[overIndex].isFlipped
      ) {
        return prevCards;
      }
      
      // 카드 위치 교환
      const temp = newCards[activeIndex];
      newCards[activeIndex] = newCards[overIndex];
      newCards[overIndex] = temp;
      
      return newCards;
    });
  };
  
  // 카드 ID 배열
  const cardIds = cards.map(card => card.id);
  
  if (!mounted) {
    return <div className="min-h-screen flex items-center justify-center">로딩 중...</div>;
  }
  
  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={cardIds} strategy={rectSortingStrategy}>
        <div className="flex flex-col items-center justify-center min-h-screen">
          <h1 className="text-2xl font-bold mb-4 text-gray-700">폭탄 찾기 게임</h1>
          <p className="mb-8 text-gray-600">카드를 클릭하여 뒤집거나 드래그하여 순서를 변경해보세요</p>
          
          {gameOver && (
            <div className="mb-4">
              <div className={`text-center text-xl mb-4 ${bombFound ? 'text-red-500' : 'text-green-500'}`}>
                {bombFound ? '💥 폭탄을 찾았습니다!' : '🎉 성공! 모든 안전 카드를 찾았습니다!'}
              </div>
              <button 
                onClick={initGame}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
              >
                게임 재시작
              </button>
            </div>
          )}
          
          <motion.div 
            className="grid grid-cols-3 gap-4 p-8"
            layout
          >
            <AnimatePresence mode="popLayout">
              {cards.map((card, index) => (
                <motion.div
                  key={card.id}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 25,
                    mass: 1
                  }}
                >
                  <DropArea
                    id={card.id}
                    isActive={activeId === card.id}
                    isOver={false}
                  >
                    <DraggableCard
                      card={card}
                      isDragging={activeId === card.id}
                      onFlip={handleFlip}
                      index={index}
                    />
                  </DropArea>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
          
          <p className="mt-6 text-gray-600 text-sm flex items-center gap-2">
            <span className="px-2 py-1 bg-blue-500 text-white text-xs rounded-md">드래그</span> 
            <span>순서 변경</span>
            <span className="ml-2 px-2 py-1 bg-gray-700 text-white text-xs rounded-md">클릭</span>
            <span>카드 뒤집기</span>
          </p>
        </div>
      </SortableContext>
    </DndContext>
  );
}

/* 3D 효과를 위한 CSS */
const styles = `
  .preserve-3d {
    transform-style: preserve-3d;
    position: relative;
  }
  
  .backface-hidden {
    backface-visibility: hidden;
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }
`;

// CSS를 head에 추가
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);
}
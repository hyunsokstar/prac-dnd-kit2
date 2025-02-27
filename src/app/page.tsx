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

// 박스 데이터 타입 정의
interface BoxItem {
  id: string;
  content: string;
  order: number;
  isFlipped: boolean; // 카드가 뒤집혔는지 여부
  isBomb: boolean;    // 폭탄인지 여부
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
 * 드래그 가능한 카드 컴포넌트 (클릭시 뒤집기 기능 포함)
 */
const DraggableBox = ({
  item,
  isDragging,
  onFlip,
}: {
  item: BoxItem;
  isDragging: boolean;
  onFlip: (id: string) => void;
}) => {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: item.id,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  // 카드 클릭 핸들러
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFlip(item.id);
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
          transform: item.isFlipped ? 'rotateY(180deg)' : ''
        }}
      >
        <CardFront content={item.content} />
        <CardBack isBomb={item.isBomb} />
      </div>
    </div>
  );
};

/**
 * 드롭 가능한 영역
 */
const DropZone = ({
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
  const { setNodeRef, isOver: dropIsOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`w-28 h-28 flex items-center justify-center transition-all duration-200
        ${isOver || dropIsOver ? "scale-105" : ""}`}
    >
      {children}
    </div>
  );
};

/**
 * 메인 컴포넌트
 */
export default function Page() {
  // 클라이언트 마운트 여부 체크 (hydration 에러 방지)
  const [mounted, setMounted] = useState(false);
  
  // 모든 훅은 항상 호출합니다.
  const [boxesById, setBoxesById] = useState<Record<string, BoxItem>>({});
  const [bombFound, setBombFound] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [flippedCount, setFlippedCount] = useState(0);
  
  // 게임 초기화 (폭탄 위치 랜덤 설정)
  useEffect(() => {
    const initializeGame = () => {
      // 폭탄을 랜덤 위치에 설정
      const randomBombPosition = Math.floor(Math.random() * 9);
      
      const initialBoxes: Record<string, BoxItem> = {};
      for (let i = 1; i <= 9; i++) {
        initialBoxes[`box-${i}`] = {
          id: `box-${i}`,
          content: `${i}`,
          order: i - 1,
          isFlipped: false,
          isBomb: i - 1 === randomBombPosition
        };
      }
      
      setBoxesById(initialBoxes);
      setBombFound(false);
      setGameOver(false);
      setFlippedCount(0);
    };
    
    initializeGame();
    setMounted(true);
  }, []);
  
  // 게임 리셋 함수
  const resetGame = () => {
    // 폭탄을 랜덤 위치에 설정
    const randomBombPosition = Math.floor(Math.random() * 9);
    
    const initialBoxes: Record<string, BoxItem> = {};
    for (let i = 1; i <= 9; i++) {
      initialBoxes[`box-${i}`] = {
        id: `box-${i}`,
        content: `${i}`,
        order: i - 1,
        isFlipped: false,
        isBomb: i - 1 === randomBombPosition
      };
    }
    
    setBoxesById(initialBoxes);
    setBombFound(false);
    setGameOver(false);
    setFlippedCount(0);
  };
  
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [hoveredDropZone, setHoveredDropZone] = useState<string | null>(null);
  
  // 드롭존 맵 초기화
  const [dropZoneMap, setDropZoneMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (Object.keys(boxesById).length > 0) {
      const initialMap: Record<string, string> = {};
      Object.keys(boxesById).forEach((id, index) => {
        initialMap[id] = `drop-${boxesById[id].order}`;
      });
      setDropZoneMap(initialMap);
    }
  }, [boxesById]);
  
  // 포인터 센서 설정 - 드래그 감지 민감도 조정
  const sensors = useSensors(
    useSensor(PointerSensor, { 
      activationConstraint: { 
        distance: 10, // 더 멀리 이동해야 드래그 시작 (클릭 이벤트와 구분)
      } 
    })
  );
  
  // 카드 뒤집기 핸들러
  const handleFlipCard = useCallback((id: string) => {
    // 게임이 끝났거나 이미 뒤집힌 카드는 무시
    if (gameOver || boxesById[id]?.isFlipped) return;
    
    // 카드 뒤집기
    setBoxesById(prev => {
      if (!prev[id]) return prev;
      
      return {
        ...prev,
        [id]: {
          ...prev[id],
          isFlipped: true
        }
      };
    });
    
    // 뒤집은 카드 수 증가
    setFlippedCount(count => count + 1);
    
    // 폭탄 체크
    if (boxesById[id]?.isBomb) {
      setBombFound(true);
      setGameOver(true);
    } else if (flippedCount + 1 === 8) {
      // 모든 안전 카드를 뒤집었을 때 (폭탄 제외 8개)
      setGameOver(true);
    }
  }, [boxesById, gameOver, flippedCount]);

  const getSortedBoxes = useCallback(() => {
    if (Object.keys(boxesById).length === 0) return [];
    return Object.values(boxesById).sort((a, b) => a.order - b.order);
  }, [boxesById]);

  const getSortedBoxIds = useCallback(() => {
    return getSortedBoxes().map(box => box.id);
  }, [getSortedBoxes]);

  const handleDragStart = (event: DragStartEvent) => {
    // 뒤집힌 카드는 드래그 불가
    const boxId = event.active.id as string;
    if (boxesById[boxId]?.isFlipped || gameOver) {
      return;
    }
    
    setActiveId(event.active.id);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    setHoveredDropZone(over ? String(over.id) : null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setHoveredDropZone(null);
    
    if (!over) return;

    const activeBoxId = active.id as string;
    let targetBoxId: string | null = null;

    if (typeof over.id === "string" && over.id.startsWith("drop-")) {
      // 드롭존에 드롭한 경우 해당 드롭존에 있는 박스 ID 찾기
      targetBoxId =
        Object.keys(dropZoneMap).find((key) => dropZoneMap[key] === over.id) ||
        null;
    } else {
      // 직접 박스에 드롭한 경우
      targetBoxId = over.id as string;
    }
    
    if (!targetBoxId || activeBoxId === targetBoxId) return;
    
    // 뒤집힌 카드가 있으면 위치 변경 불가
    if (boxesById[activeBoxId]?.isFlipped || boxesById[targetBoxId]?.isFlipped) {
      return;
    }

    // 박스 순서 업데이트
    setBoxesById(prev => {
      if (!prev[activeBoxId] || !prev[targetBoxId]) return prev;
      
      const updatedBoxes = { ...prev };
      const tempOrder = updatedBoxes[activeBoxId].order;
      updatedBoxes[activeBoxId].order = updatedBoxes[targetBoxId].order;
      updatedBoxes[targetBoxId].order = tempOrder;
      return updatedBoxes;
    });

    // 드롭존 매핑 업데이트 - handleDragEnd 이후에 useEffect에서 자동으로 업데이트됨
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setHoveredDropZone(null);
  };

  const sortedBoxes = getSortedBoxes();
  const sortedIds = getSortedBoxIds();

  // 모든 훅 호출 후, mounted 여부에 따라 렌더링 분기
  if (!mounted || sortedBoxes.length === 0) {
    return <div className="min-h-screen flex items-center justify-center">로딩 중...</div>;
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={sortedIds} strategy={rectSortingStrategy}>
        <div className="flex flex-col items-center justify-center min-h-screen">
          <h1 className="text-2xl font-bold mb-4 text-gray-700">폭탄 찾기 게임</h1>
          <p className="mb-8 text-gray-600">카드를 클릭하여 뒤집거나 드래그하여 순서를 변경해보세요</p>
          
          {gameOver && (
            <div className="mb-4">
              <div className={`text-center text-xl mb-4 ${bombFound ? 'text-red-500' : 'text-green-500'}`}>
                {bombFound ? '💥 폭탄을 찾았습니다!' : '🎉 성공! 모든 안전 카드를 찾았습니다!'}
              </div>
              <button 
                onClick={resetGame}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
              >
                게임 재시작
              </button>
            </div>
          )}
          
          <div className="relative">
            <div className="grid grid-cols-3 gap-4 p-8">
              {sortedBoxes.map((box, index) => (
                <div key={`${box.id}-container`}>
                  <DropZone 
                    id={`drop-${box.order}`} 
                    isActive={activeId === box.id}
                    isOver={hoveredDropZone === `drop-${box.order}`}
                  >
                    <DraggableBox 
                      item={box} 
                      isDragging={activeId === box.id}
                      onFlip={handleFlipCard}
                    />
                  </DropZone>
                </div>
              ))}
            </div>
          </div>
          
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
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
  KeyboardSensor,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { motion, AnimatePresence } from "framer-motion";

// 박스 데이터 타입 정의
interface BoxItem {
  id: string;
  color: string;
  content: string;
  order: number;
}

/**
 * 드래그 가능한 박스 컴포넌트
 */
const DraggableBox = ({
  item,
  isDragging,
}: {
  item: BoxItem;
  isDragging: boolean;
}) => {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: item.id,
  });

  const style = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`w-32 h-32 text-white flex items-center justify-center cursor-grab rounded-lg shadow-md
        ${item.color} ${isDragging ? "ring-2 ring-white ring-opacity-60 opacity-90" : ""}`}
    >
      <div className="text-center">
        <div className="font-bold">{item.content}</div>
        <div className="text-xs mt-1 opacity-80">순서: {item.order + 1}</div>
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
    <motion.div
      ref={setNodeRef}
      layout
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 30
      }}
      className={`w-36 h-36 flex items-center justify-center transition-all duration-200 
        ${isActive ? "bg-gray-100 rounded-lg" : ""}
        ${isOver || dropIsOver ? "bg-gray-200 rounded-lg" : ""}`}
    >
      {children}
    </motion.div>
  );
};

/**
 * 메인 컴포넌트
 */
export default function Page() {
  // 클라이언트 마운트 여부 체크 (hydration 에러 방지)
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // 모든 훅은 항상 호출합니다.
  const [boxesById, setBoxesById] = useState<Record<string, BoxItem>>({
    "box-1": { id: "box-1", color: "bg-blue-500", content: "Box 1", order: 0 },
    "box-2": { id: "box-2", color: "bg-green-500", content: "Box 2", order: 1 },
    "box-3": { id: "box-3", color: "bg-purple-500", content: "Box 3", order: 2 },
  });
  
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [hoveredDropZone, setHoveredDropZone] = useState<string | null>(null);
  
  const [dropZoneMap, setDropZoneMap] = useState<Record<string, string>>({
    "box-1": "drop-0",
    "box-2": "drop-1",
    "box-3": "drop-2",
  });
  
  // 포인터 센서 설정 - 드래그 감지 민감도 조정 (시작 민감도 낮추기)
  const sensors = useSensors(
    useSensor(PointerSensor, { 
      activationConstraint: { 
        distance: 3, // 더 낮은 거리로 설정
        delay: 0,    // 딜레이 제거
      } 
    })
  );

  const getSortedBoxes = useCallback(() => {
    return Object.values(boxesById).sort((a, b) => a.order - b.order);
  }, [boxesById]);

  const getSortedBoxIds = useCallback(() => {
    return getSortedBoxes().map((box) => box.id);
  }, [getSortedBoxes]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    setHoveredDropZone(over ? String(over.id) : null);
  };

  // 두 박스의 order 값을 직접 스왑하는 로직
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

    // 박스 순서 업데이트
    const updatedBoxes = { ...boxesById };
    const tempOrder = updatedBoxes[activeBoxId].order;
    updatedBoxes[activeBoxId].order = updatedBoxes[targetBoxId].order;
    updatedBoxes[targetBoxId].order = tempOrder;
    
    // 상태 업데이트
    setBoxesById(updatedBoxes);

    // 드롭존 매핑 업데이트
    const sortedBoxes = Object.values(updatedBoxes).sort(
      (a, b) => a.order - b.order
    );
    const newDropZoneMap: Record<string, string> = {};
    sortedBoxes.forEach((box, index) => {
      newDropZoneMap[box.id] = `drop-${index}`;
    });
    setDropZoneMap(newDropZoneMap);
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setHoveredDropZone(null);
  };

  const sortedBoxes = getSortedBoxes();
  const sortedIds = getSortedBoxIds();

  // 모든 훅 호출 후, mounted 여부에 따라 렌더링 분기
  if (!mounted) {
    return <div className="min-h-screen bg-gray-50" />;
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
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
          <h1 className="text-2xl font-bold mb-8 text-gray-700">드래그 앤 드롭 데모</h1>
          
          <motion.div 
            className="flex gap-8 p-10 rounded-xl bg-white shadow-sm"
            layout
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30
            }}
          >
            <AnimatePresence mode="popLayout">
              {sortedBoxes.map((box, index) => (
                <motion.div
                  key={`${box.id}-container`}
                  layout
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.9 }}
                  transition={{
                    type: "spring",
                    stiffness: 500,
                    damping: 30,
                    mass: 1
                  }}
                >
                  <DropZone 
                    id={`drop-${index}`} 
                    isActive={activeId === box.id}
                    isOver={hoveredDropZone === `drop-${index}`}
                  >
                    <DraggableBox 
                      item={box} 
                      isDragging={activeId === box.id} 
                    />
                  </DropZone>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
          
          <p className="mt-6 text-gray-600 text-sm">박스를 드래그하여 순서를 변경해보세요.</p>
        </div>
      </SortableContext>
    </DndContext>
  );
}
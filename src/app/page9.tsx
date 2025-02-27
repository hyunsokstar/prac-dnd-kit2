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
      className={`w-24 h-24 text-white flex items-center justify-center cursor-grab rounded-lg shadow-md
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
      className={`w-28 h-28 flex items-center justify-center transition-all duration-200 
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
    "box-4": { id: "box-4", color: "bg-red-500", content: "Box 4", order: 3 },
    "box-5": { id: "box-5", color: "bg-yellow-500", content: "Box 5", order: 4 },
    "box-6": { id: "box-6", color: "bg-pink-500", content: "Box 6", order: 5 },
    "box-7": { id: "box-7", color: "bg-indigo-500", content: "Box 7", order: 6 },
    "box-8": { id: "box-8", color: "bg-teal-500", content: "Box 8", order: 7 },
    "box-9": { id: "box-9", color: "bg-orange-500", content: "Box 9", order: 8 },
  });
  
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [hoveredDropZone, setHoveredDropZone] = useState<string | null>(null);
  
  // 드롭존 맵 초기화
  const [dropZoneMap, setDropZoneMap] = useState<Record<string, string>>(() => {
    const initialMap: Record<string, string> = {};
    Object.keys(boxesById).forEach((id, index) => {
      initialMap[id] = `drop-${index}`;
    });
    return initialMap;
  });
  
  // 포인터 센서 설정 - 드래그 감지 민감도 조정
  const sensors = useSensors(
    useSensor(PointerSensor, { 
      activationConstraint: { 
        distance: 3,
        delay: 0,
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
          <h1 className="text-2xl font-bold mb-8 text-gray-700">3x3 드래그 앤 드롭 그리드</h1>
          
          <motion.div 
            className="grid grid-cols-3 gap-4 p-8 rounded-xl bg-white shadow-sm"
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
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
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
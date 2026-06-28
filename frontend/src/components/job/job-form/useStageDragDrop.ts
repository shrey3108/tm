import { useState, useRef, useCallback } from "react";
import type { JobStageConfig } from "@/types/stage";

interface UseStageDragDropOptions {
  stages: JobStageConfig[];
  onReorder: (reordered: JobStageConfig[]) => void;
}

export const useStageDragDrop = ({ stages, onReorder }: UseStageDragDropOptions) => {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const dragNodeRef = useRef<HTMLDivElement | null>(null);

  const resetDragState = useCallback(() => {
    if (dragNodeRef.current) {
      dragNodeRef.current.style.opacity = "1";
    }
    setDragIndex(null);
    setOverIndex(null);
    dragNodeRef.current = null;
  }, []);

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>, index: number) => {
      setDragIndex(index);
      dragNodeRef.current = e.currentTarget;
      e.dataTransfer.effectAllowed = "move";
      // Make the drag image slightly transparent
      requestAnimationFrame(() => {
        if (dragNodeRef.current) {
          dragNodeRef.current.style.opacity = "0.4";
        }
      });
    },
    [],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (dragIndex === null || dragIndex === index) return;
      setOverIndex(index);
    },
    [dragIndex],
  );

  const handleDragLeave = useCallback(() => {
    setOverIndex(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>, dropIndex: number) => {
      e.preventDefault();
      if (dragIndex === null || dragIndex === dropIndex) {
        resetDragState();
        return;
      }

      // Reorder locally first for instant feedback
      const reordered = [...stages];
      const [moved] = reordered.splice(dragIndex, 1);
      reordered.splice(dropIndex, 0, moved);

      resetDragState();
      onReorder(reordered);
    },
    [dragIndex, stages, onReorder, resetDragState],
  );

  const handleDragEnd = useCallback(() => {
    resetDragState();
  }, [resetDragState]);

  return {
    dragIndex,
    overIndex,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
  };
};

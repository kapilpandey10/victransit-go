import { useState, useRef, useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate, PanInfo } from 'framer-motion';
import { cn } from '@/lib/utils';

interface BottomSheetProps {
  children: React.ReactNode;
  className?: string;
}

const SNAP_POINTS = {
  collapsed: 0.35,  // 35% of viewport
  half: 0.55,
  expanded: 0.92,
};

export function BottomSheet({ children, className }: BottomSheetProps) {
  const [snapPoint, setSnapPoint] = useState<keyof typeof SNAP_POINTS>('half');
  const containerRef = useRef<HTMLDivElement>(null);
  const y = useMotionValue(0);

  const getHeight = (point: keyof typeof SNAP_POINTS) => {
    return window.innerHeight * SNAP_POINTS[point];
  };

  useEffect(() => {
    const height = getHeight(snapPoint);
    animate(y, window.innerHeight - height, { type: 'spring', stiffness: 400, damping: 40 });
  }, [snapPoint]);

  const handleDragEnd = (_: any, info: PanInfo) => {
    const currentY = y.get();
    const vh = window.innerHeight;
    const ratio = 1 - currentY / vh;

    if (info.velocity.y < -500) {
      setSnapPoint(snapPoint === 'collapsed' ? 'half' : 'expanded');
    } else if (info.velocity.y > 500) {
      setSnapPoint(snapPoint === 'expanded' ? 'half' : 'collapsed');
    } else {
      if (ratio > 0.75) setSnapPoint('expanded');
      else if (ratio > 0.45) setSnapPoint('half');
      else setSnapPoint('collapsed');
    }
  };

  return (
    <motion.div
      ref={containerRef}
      style={{ y }}
      drag="y"
      dragConstraints={{
        top: window.innerHeight * (1 - SNAP_POINTS.expanded),
        bottom: window.innerHeight * (1 - SNAP_POINTS.collapsed),
      }}
      dragElastic={0.1}
      onDragEnd={handleDragEnd}
      className={cn(
        'fixed inset-x-0 bottom-0 z-20 bg-background rounded-t-2xl shadow-[0_-4px_24px_rgba(0,0,0,0.12)] flex flex-col',
        className
      )}
      style={{ y, height: `${SNAP_POINTS.expanded * 100}vh` } as any}
    >
      {/* Handle */}
      <div className="flex justify-center py-3 cursor-grab active:cursor-grabbing">
        <div className="sheet-handle" />
      </div>
      {/* Content */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-8">
        {children}
      </div>
    </motion.div>
  );
}

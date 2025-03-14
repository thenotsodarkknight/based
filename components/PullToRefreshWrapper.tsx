import React, { useState, useRef } from "react";

interface PullToRefreshWrapperProps {
    onRefresh: () => Promise<void> | void; // Refresh can be async or sync
    children: React.ReactNode;
}

const PullToRefreshWrapper: React.FC<PullToRefreshWrapperProps> = ({
    onRefresh,
    children,
}) => {
    const [pullDistance, setPullDistance] = useState(0);
    const startY = useRef<number>(0);
    const pulling = useRef<boolean>(false);
    const threshold = 80; // distance to trigger a refresh

    const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
        // Only start tracking if we're at the very top
        if (window.scrollY === 0) {
            pulling.current = true;
            startY.current = e.touches[0].clientY;
        }
    };

    const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
        if (!pulling.current) return;
        const currentY = e.touches[0].clientY;
        const diff = currentY - startY.current;
        // Once user moves finger up or no longer pulling down, reset
        if (diff <= 0) {
            pulling.current = false;
            setPullDistance(0);
            return;
        }
        // Limit the pull distance so it doesn't go on forever
        setPullDistance(diff > 120 ? 120 : diff);
    };

    const handleTouchEnd = async () => {
        if (pullDistance >= threshold) {
            // Trigger the actual refresh if we've crossed threshold
            await onRefresh();
        }
        // Animate back to zero
        pulling.current = false;
        setPullDistance(0);
    };

    return (
        <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{
                transform: pullDistance ? `translateY(${pullDistance}px)` : "none",
                transition: pulling.current ? "none" : "transform 0.25s ease",
            }}
        >
            {children}
        </div>
    );
};

export default PullToRefreshWrapper;

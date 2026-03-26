/**
 * ReadModeOverlay
 *
 * The read-mode overlay pill displayed on hover over DepixCanvasEditable.
 * Contains scene navigation (prev/next), fullscreen button, and edit button.
 */

import React from 'react';
import { CaretLeft, CaretRight, CornersOut, PencilSimple } from '@phosphor-icons/react';
import { overlayPillStyle, pillIconBtnStyle, OVERLAY_PILL_POSITIONS } from './editable-styles.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReadModeOverlayProps {
  /** Position of the overlay pill. */
  editButtonPosition: string;
  /** Whether the container is hovered. */
  isHovered: boolean;
  /** Current scene index. */
  currentSceneIndex: number;
  /** Total number of scenes. */
  totalScenes: number;
  /** Display name of the current scene. */
  sceneName: string;
  /** Fitted canvas dimensions (from fitToAspectRatio). */
  fitted: { width: number; height: number };
  /** Navigate to the previous scene. */
  goToPrevScene: () => void;
  /** Navigate to the next scene. */
  goToNextScene: () => void;
  /** Enter fullscreen mode. */
  enterFullscreen: () => void;
  /** Enter edit mode. */
  enterEditMode: () => void;
}

// ---------------------------------------------------------------------------
// Hover helper
// ---------------------------------------------------------------------------

const hoverBg = 'rgba(255,255,255,0.12)';

function onBtnEnter(e: React.MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.backgroundColor = hoverBg;
}

function onBtnLeave(e: React.MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.backgroundColor = 'transparent';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReadModeOverlay({
  editButtonPosition,
  isHovered,
  currentSceneIndex,
  totalScenes,
  sceneName,
  fitted,
  goToPrevScene,
  goToNextScene,
  enterFullscreen,
  enterEditMode,
}: ReadModeOverlayProps) {
  const hasMultipleScenes = totalScenes > 1;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 10,
      }}
    >
      <div style={{ position: 'relative', width: fitted.width, height: fitted.height }}>
        <div
          data-edit-button
          style={{
            ...overlayPillStyle,
            ...OVERLAY_PILL_POSITIONS[editButtonPosition],
            opacity: isHovered ? 1 : 0,
            pointerEvents: isHovered ? 'auto' : 'none',
          }}
        >
          {/* Scene navigation (only when multiple scenes) */}
          {hasMultipleScenes && (
            <>
              <button
                type="button"
                style={{
                  ...pillIconBtnStyle,
                  opacity: currentSceneIndex > 0 ? 1 : 0.35,
                }}
                onClick={goToPrevScene}
                disabled={currentSceneIndex === 0}
                title="Previous scene"
                onMouseEnter={currentSceneIndex > 0 ? onBtnEnter : undefined}
                onMouseLeave={onBtnLeave}
              >
                <CaretLeft size={14} weight="bold" />
              </button>
              <span
                style={{
                  color: '#ddd',
                  fontSize: '12px',
                  fontFamily: 'system-ui, sans-serif',
                  padding: '0 2px',
                  whiteSpace: 'nowrap',
                  userSelect: 'none',
                  maxWidth: '120px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {sceneName}
              </span>
              <button
                type="button"
                style={{
                  ...pillIconBtnStyle,
                  opacity: currentSceneIndex < totalScenes - 1 ? 1 : 0.35,
                }}
                onClick={goToNextScene}
                disabled={currentSceneIndex === totalScenes - 1}
                title="Next scene"
                onMouseEnter={currentSceneIndex < totalScenes - 1 ? onBtnEnter : undefined}
                onMouseLeave={onBtnLeave}
              >
                <CaretRight size={14} weight="bold" />
              </button>
              {/* Divider */}
              <div
                style={{
                  width: '1px',
                  height: '18px',
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  margin: '0 2px',
                  flexShrink: 0,
                }}
              />
            </>
          )}
          <button
            type="button"
            style={pillIconBtnStyle}
            onClick={enterFullscreen}
            title="Fullscreen"
            onMouseEnter={onBtnEnter}
            onMouseLeave={onBtnLeave}
          >
            <CornersOut size={16} weight="bold" />
          </button>
          <button
            type="button"
            style={pillIconBtnStyle}
            onClick={enterEditMode}
            title="Edit"
            onMouseEnter={onBtnEnter}
            onMouseLeave={onBtnLeave}
          >
            <PencilSimple size={16} weight="bold" />
          </button>
        </div>
      </div>
    </div>
  );
}

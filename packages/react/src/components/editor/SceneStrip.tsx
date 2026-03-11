/**
 * SceneStrip — vertical scene thumbnail strip for DSL editor.
 * Shows scene list with add/delete/reorder controls.
 */

import React from 'react';
import { EDITOR_COLORS } from './editor-colors.js';

export interface SceneStripScene {
  index: number;
  title: string;
  thumbnail?: string;
}

export interface SceneStripProps {
  scenes: SceneStripScene[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onReorder?: (from: number, to: number) => void;
  onDelete?: (index: number) => void;
}

export function SceneStrip({
  scenes,
  activeIndex,
  onSelect,
  onAdd,
  onDelete,
}: SceneStripProps) {
  return (
    <div
      style={{
        width: 60,
        height: '100%',
        background: EDITOR_COLORS.bg,
        borderRight: `1px solid ${EDITOR_COLORS.border}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '8px 0',
        gap: 6,
        overflowY: 'auto',
        flexShrink: 0,
      }}
    >
      {scenes.map((scene) => (
        <div
          key={scene.index}
          onClick={() => onSelect(scene.index)}
          style={{
            width: 44,
            height: 28,
            borderRadius: 4,
            border: `2px solid ${scene.index === activeIndex ? EDITOR_COLORS.accent : EDITOR_COLORS.border}`,
            background: scene.index === activeIndex ? EDITOR_COLORS.bgLighter : EDITOR_COLORS.bgLight,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            fontSize: 9,
            color: EDITOR_COLORS.textMuted,
            overflow: 'hidden',
          }}
          title={scene.title || `Scene ${scene.index + 1}`}
        >
          {scene.thumbnail ? (
            <img
              src={scene.thumbnail}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span>{scene.index + 1}</span>
          )}
          {onDelete && scenes.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(scene.index);
              }}
              style={{
                position: 'absolute',
                top: -4,
                right: -4,
                width: 14,
                height: 14,
                borderRadius: '50%',
                border: 'none',
                background: EDITOR_COLORS.danger,
                color: '#fff',
                fontSize: 8,
                cursor: 'pointer',
                display: 'none',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                lineHeight: 1,
              }}
              className="scene-strip-delete"
            >
              ×
            </button>
          )}
        </div>
      ))}
      <button
        onClick={onAdd}
        style={{
          width: 44,
          height: 28,
          borderRadius: 4,
          border: `1px dashed ${EDITOR_COLORS.textDim}`,
          background: 'transparent',
          color: EDITOR_COLORS.textDim,
          cursor: 'pointer',
          fontSize: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        title="Add scene"
      >
        +
      </button>
    </div>
  );
}

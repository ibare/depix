/**
 * SceneTab
 *
 * Property panel tab for managing scenes (slides).
 * Shows scene list with current scene highlighted,
 * supports adding, deleting, renaming, and switching scenes.
 */

import React, { useState } from 'react';
import type { IRScene } from '@depix/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SceneTabProps {
  /** All scenes in the document. */
  scenes: IRScene[];
  /** Index of the currently active scene. */
  currentSceneIndex: number;
  /** Callback when a scene is clicked to switch to it. */
  onSceneChange?: (index: number) => void;
  /** Callback to add a new scene. */
  onAddScene?: () => void;
  /** Callback to delete a scene by index. */
  onDeleteScene?: (index: number) => void;
  /** Callback to rename a scene. */
  onRenameScene?: (index: number, name: string) => void;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const listStyle: React.CSSProperties = {
  padding: '4px 0',
  listStyle: 'none',
  margin: 0,
};

const sceneItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 10px',
  cursor: 'pointer',
  fontSize: '11px',
  borderRadius: '4px',
  margin: '2px 4px',
};

const currentSceneStyle: React.CSSProperties = {
  ...sceneItemStyle,
  backgroundColor: 'rgba(59, 130, 246, 0.2)',
};

const sceneNumberStyle: React.CSSProperties = {
  width: '20px',
  height: '20px',
  borderRadius: '4px',
  backgroundColor: '#333',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '10px',
  fontWeight: 600,
  color: '#aaa',
  flexShrink: 0,
};

const sceneLabelStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: '#ccc',
};

const sceneCountStyle: React.CSSProperties = {
  fontSize: '10px',
  color: '#666',
  flexShrink: 0,
};

const deleteBtnStyle: React.CSSProperties = {
  width: '18px',
  height: '18px',
  padding: 0,
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  color: '#666',
  fontSize: '13px',
  lineHeight: 1,
  flexShrink: 0,
};

const addBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '4px',
  width: 'calc(100% - 8px)',
  margin: '4px 4px 8px',
  padding: '6px',
  border: '1px dashed #444',
  borderRadius: '4px',
  backgroundColor: 'transparent',
  color: '#888',
  cursor: 'pointer',
  fontSize: '11px',
};

const inlineInputStyle: React.CSSProperties = {
  flex: 1,
  padding: '1px 4px',
  border: '1px solid #3b82f6',
  borderRadius: '2px',
  backgroundColor: '#2a2a2a',
  color: '#ddd',
  fontSize: '11px',
  outline: 'none',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const SceneTab: React.FC<SceneTabProps> = ({
  scenes,
  currentSceneIndex,
  onSceneChange,
  onAddScene,
  onDeleteScene,
  onRenameScene,
}) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleDoubleClick = (index: number, currentName: string) => {
    setEditingIndex(index);
    setEditingName(currentName);
  };

  const handleRenameConfirm = () => {
    if (editingIndex !== null && editingName.trim()) {
      onRenameScene?.(editingIndex, editingName.trim());
    }
    setEditingIndex(null);
  };

  const getSceneName = (scene: IRScene, index: number): string => {
    return (scene as unknown as { name?: string }).name || `Scene ${index + 1}`;
  };

  return (
    <div data-tab="scenes">
      <ul style={listStyle}>
        {scenes.map((scene, index) => {
          const isCurrent = index === currentSceneIndex;
          const isEditing = editingIndex === index;

          return (
            <li
              key={scene.id}
              data-scene-index={index}
              style={isCurrent ? currentSceneStyle : sceneItemStyle}
              onClick={() => onSceneChange?.(index)}
              onDoubleClick={() => handleDoubleClick(index, getSceneName(scene, index))}
            >
              <div style={sceneNumberStyle}>{index + 1}</div>

              {isEditing ? (
                <input
                  style={inlineInputStyle}
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={handleRenameConfirm}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRenameConfirm();
                    if (e.key === 'Escape') setEditingIndex(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                />
              ) : (
                <span style={sceneLabelStyle}>{getSceneName(scene, index)}</span>
              )}

              <span style={sceneCountStyle}>{scene.elements.length}</span>

              {scenes.length > 1 && (
                <button
                  type="button"
                  style={deleteBtnStyle}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteScene?.(index);
                  }}
                  title="Delete scene"
                  aria-label="Delete scene"
                >
                  ×
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        style={addBtnStyle}
        onClick={onAddScene}
      >
        + New Scene
      </button>
    </div>
  );
};

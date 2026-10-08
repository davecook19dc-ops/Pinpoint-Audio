import React, { useState, useEffect } from 'react';
import { Folder as FolderIcon, X, Plus } from 'lucide-react';
import { Folder } from '../types';
import { dbService } from '../services/db';

export const FOLDER_COLORS = [
  '#0ea5e9', // Powder Sky Blue
  '#10B981', // Mint Green
  '#F59E0B', // Sunny Amber
  '#EC4899', // Fuchsia Rose
  '#8B5CF6', // Chalk Violet
  '#F97316', // Bright Coral
  '#6366F1', // Indigo
  '#14B8A6', // Teal
];

interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  setFolders?: React.Dispatch<React.SetStateAction<Folder[]>>;
  showToast?: (msg: string) => void;
  onFolderCreated?: (folder: Folder) => void;
  onCreateFolder?: (name: string, color: string) => Promise<void> | void;
}

export const CreateFolderModal: React.FC<CreateFolderModalProps> = ({
  isOpen,
  onClose,
  setFolders,
  showToast,
  onFolderCreated,
  onCreateFolder,
}) => {
  const [folderName, setFolderName] = useState('');
  const [selectedColor, setSelectedColor] = useState('#0ea5e9');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFolderName('');
      setSelectedColor('#0ea5e9');
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim() || isSubmitting) return;

    const newFolder: Folder = {
      id: `folder-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      name: folderName.trim(),
      color: selectedColor || '#0ea5e9',
      createdAt: Date.now(),
      isDeleted: false,
    };

    setIsSubmitting(true);
    try {
      if (onCreateFolder) {
        await onCreateFolder(newFolder.name, newFolder.color);
      } else {
        await dbService.saveFolder(newFolder);
        if (setFolders) {
          setFolders((prev) => [...prev, newFolder]);
        }
        if (showToast) {
          showToast(`Folder "${newFolder.name}" created!`);
        }
      }

      if (onFolderCreated) {
        onFolderCreated(newFolder);
      }

      setFolderName('');
      onClose();
    } catch (error) {
      console.error('Folder save error:', error);
      if (showToast) {
        showToast('Failed to save folder to database.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-2xs transition-colors"
              style={{ backgroundColor: selectedColor }}
            >
              <FolderIcon className="w-4 h-4 fill-current/30" />
            </div>
            <h3 className="text-base font-bold text-stone-900 dark:text-white">
              Create New Folder
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleCreateFolder} className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-2">
              Folder Name
            </label>
            <input
              type="text"
              autoFocus
              placeholder="e.g. Physics 101, Work Meetings..."
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/80 text-stone-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-2">
              Folder Color
            </label>
            <div className="flex items-center gap-2.5 flex-wrap">
              {FOLDER_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`w-7 h-7 rounded-full transition-transform cursor-pointer flex items-center justify-center ${
                    selectedColor === color
                      ? 'scale-110 ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-stone-900'
                      : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-100 dark:border-stone-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!folderName.trim() || isSubmitting}
              className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Creating...' : 'Create Folder'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

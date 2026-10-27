import React, { useState } from 'react';
import { Category, User } from '../types/inventory';
import { X, Plus, Trash2, FolderPlus, Layers, AlertCircle, CheckCircle2 } from 'lucide-react';

import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface ManageCategoriesModalProps {
  categories: Category[];
  currentUser: User;
  onClose: () => void;
  onAddCategory: (name: string, description?: string) => Promise<void> | void;
  onDeleteCategory: (categoryId: string) => Promise<void> | void;
}

export const ManageCategoriesModal: React.FC<ManageCategoriesModalProps> = ({
  categories,
  currentUser,
  onClose,
  onAddCategory,
  onDeleteCategory,
}) => {
  const [newCatName, setNewCatName] = useState('');
  const [newCatDescription, setNewCatDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const trimmed = newCatName.trim();
    if (!trimmed) {
      setErrorMsg('Please enter a category name');
      return;
    }

    if (categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      setErrorMsg('A category with this name already exists');
      return;
    }

    try {
      setIsSubmitting(true);
      await onAddCategory(trimmed, newCatDescription.trim() || undefined);
      setNewCatName('');
      setNewCatDescription('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create category');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!categoryToDelete) return;
    try {
      setIsDeletingCategory(true);
      setDeletingId(categoryToDelete.id);
      await onDeleteCategory(categoryToDelete.id);
      setCategoryToDelete(null);
    } catch (err: any) {
      setErrorMsg(`Could not delete category: ${err.message || 'Unknown error'}`);
    } finally {
      setIsDeletingCategory(false);
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-800 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Manage Categories</h2>
              <p className="text-xs text-slate-500">Connected to products via foreign key table</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form to Add New Category */}
        <form onSubmit={handleCreate} className="p-5 border-b border-slate-100 bg-slate-50/70 space-y-3">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <FolderPlus className="w-3.5 h-3.5 text-amber-800" />
            <span>Add New Category</span>
          </div>

          <div className="space-y-2">
            <input
              type="text"
              value={newCatName}
              onChange={(e) => {
                setNewCatName(e.target.value);
                if (errorMsg) setErrorMsg('');
              }}
              placeholder="Category name (e.g. Shoes & Footwear, Tracksuits...)"
              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900"
            />
            <input
              type="text"
              value={newCatDescription}
              onChange={(e) => setNewCatDescription(e.target.value)}
              placeholder="Brief description (optional)"
              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900"
            />
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2 font-medium">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || !newCatName.trim()}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Adding...' : 'Create Category'}</span>
            </button>
          </div>
        </form>

        {/* Existing Categories List */}
        <div className="p-5 max-h-[50vh] overflow-y-auto space-y-2">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Existing Categories ({categories.length})
          </div>

          {categories.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-400">
              No categories defined yet. Add one above!
            </div>
          ) : (
            categories.map((cat) => (
              <div
                key={cat.id}
                className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-3 hover:border-slate-300 transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 truncate">{cat.name}</div>
                  {cat.description && (
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">{cat.description}</div>
                  )}
                </div>

                <button
                  type="button"
                  disabled={deletingId === cat.id}
                  onClick={() => setCategoryToDelete(cat)}
                  title={`Delete category "${cat.name}"`}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Confirmation Modal with Red Yes button & No button */}
      <ConfirmDeleteModal
        isOpen={!!categoryToDelete}
        title="Delete Category"
        itemTitle={categoryToDelete?.name}
        message={`Are you sure you want to delete category "${categoryToDelete?.name}"?`}
        details="All existing products currently linked to this category will automatically become 'Unassigned'. They will not be deleted."
        confirmLabel="Yes, Delete"
        cancelLabel="No, Cancel"
        isDeleting={isDeletingCategory}
        onConfirm={handleConfirmDelete}
        onCancel={() => setCategoryToDelete(null)}
      />
    </div>
  );
};

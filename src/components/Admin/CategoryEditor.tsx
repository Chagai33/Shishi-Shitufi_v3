import React, { useState } from 'react';
import { CategoryConfig } from '../../types';
import { AVAILABLE_ICONS } from '../../constants/templates';
import { Trash2, Plus, ChevronUp, ChevronDown } from 'lucide-react';

interface CategoryEditorProps {
  categories: CategoryConfig[];
  onChange: (newCategories: CategoryConfig[]) => void;
}

export const CategoryEditor: React.FC<CategoryEditorProps> = ({ categories, onChange }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showIconPicker, setShowIconPicker] = useState<string | null>(null);

  const handleUpdate = (id: string, field: keyof CategoryConfig, value: any) => {
    const updated = categories.map(c => c.id === id ? { ...c, [field]: value } : c);
    onChange(updated);
  };

  const handleAdd = () => {
    const newId = `custom-${Date.now()}`;
    const newCategory: CategoryConfig = {
      id: newId,
      name: 'קטגוריה חדשה',
      icon: 'wave.gif', // Default icon
      color: '#95a5a6', // Default color
      order: categories.length + 1
    };
    onChange([...categories, newCategory]);
    setEditingId(newId); // Auto-start editing
  };

  const handleDelete = (id: string) => {
    if (categories.length <= 1) return; // Prevent deleting the last category
    onChange(categories.filter(c => c.id !== id));
  };

  const moveCategory = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === categories.length - 1) return;

    const newCategories = [...categories];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    // Swap
    [newCategories[index], newCategories[targetIndex]] = [newCategories[targetIndex], newCategories[index]];

    // Update order property
    const reordered = newCategories.map((c, i) => ({ ...c, order: i + 1 }));
    onChange(reordered);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-gray-700">ניהול קטגוריות</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleAdd}
            className="text-sm text-green-600 hover:text-green-700 font-medium flex items-center gap-1"
          >
            <Plus size={16} />
            הוסף קטגוריה
          </button>
        </div>
      </div>

      <div className="space-y-2 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
        {categories.map((category, index) => (
          <div
            key={category.id}
            className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${editingId === category.id ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
          >
            {/* Order Controls */}
            <div className="flex flex-col text-gray-400">
              <button
                type="button"
                disabled={index === 0}
                onClick={() => moveCategory(index, 'up')}
                className="hover:text-gray-600 disabled:opacity-30"
              >
                <ChevronUp size={14} />
              </button>
              <button
                type="button"
                disabled={index === categories.length - 1}
                onClick={() => moveCategory(index, 'down')}
                className="hover:text-gray-600 disabled:opacity-30"
              >
                <ChevronDown size={14} />
              </button>
            </div>

            {/* Icon Picker Trigger */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowIconPicker(showIconPicker === category.id ? null : category.id)}
                className="w-10 h-10 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center hover:bg-gray-200 overflow-hidden"
              >
                <img src={`/Icons/${category.icon}`} alt="" className="w-8 h-8 object-contain" />
              </button>

              {/* Icon Picker Dropdown */}
              {showIconPicker === category.id && (
                <div className="absolute top-12 right-0 z-50 w-64 p-2 bg-white rounded-xl shadow-xl border border-gray-200 grid grid-cols-5 gap-2">
                  {AVAILABLE_ICONS.map(icon => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => {
                        handleUpdate(category.id, 'icon', icon);
                        setShowIconPicker(null);
                      }}
                      className={`p-1 rounded hover:bg-gray-100 ${category.icon === icon ? 'bg-blue-100 ring-2 ring-blue-400' : ''}`}
                    >
                      <img src={`/Icons/${icon}`} alt="" className="w-full h-full object-contain" />
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowIconPicker(null)}
                    className="col-span-5 text-xs text-center text-gray-500 hover:text-gray-700 py-1"
                  >
                    סגור
                  </button>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 space-y-2">
              <input
                type="text"
                value={category.name}
                onChange={(e) => handleUpdate(category.id, 'name', e.target.value)}
                onFocus={() => setEditingId(category.id)}
                onBlur={() => setEditingId(null)}
                className="w-full text-sm font-medium bg-transparent border-none p-0 focus:ring-0 placeholder-gray-400"
                placeholder="שם הקטגוריה"
              />

              {/* Color picker removed as per user request */}
            </div>

            {/* Actions */}
            <button
              type="button"
              onClick={() => handleDelete(category.id)}
              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
              title="מחק קטגוריה"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

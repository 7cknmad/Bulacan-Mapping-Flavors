import { Dialog } from "@headlessui/react";
import { X as CloseIcon } from "lucide-react";
import type { FilterOptions } from "../utils/constants";
import { dietaryOptions, priceRangeOptions, spicyLevelOptions } from "../utils/constants";

interface FiltersModalProps {
  isOpen: boolean;
  onClose: () => void;
  filters: FilterOptions;
  onChange: (filters: FilterOptions) => void;
}

export default function FiltersModal({ isOpen, onClose, filters, onChange }: FiltersModalProps) {
  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-lg w-full bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <Dialog.Title className="text-lg font-medium">Filter Dishes</Dialog.Title>
            <button onClick={onClose} className="p-1 rounded-full hover:bg-neutral-100">
              <CloseIcon size={20} />
            </button>
          </div>

          {/* Price Range */}
          <div className="mb-6">
            <h3 className="font-medium mb-3">Price Range</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {priceRangeOptions.map(option => (
                <button
                  key={option.key}
                  onClick={() => onChange({ ...filters, priceRange: option.key })}
                  className={`p-3 border rounded-lg text-left hover:bg-neutral-50 ${
                    filters.priceRange === option.key ? "border-primary-500 bg-primary-50" : ""
                  }`}
                >
                  <div className="font-medium">{option.label}</div>
                  <div className="text-sm text-neutral-600">{option.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Dietary Preferences */}
          <div className="mb-6">
            <h3 className="font-medium mb-3">Dietary Preferences</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {dietaryOptions.map(option => (
                <button
                  key={option.key}
                  onClick={() => {
                    const isSelected = filters.dietary.includes(option.key);
                    onChange({
                      ...filters,
                      dietary: isSelected
                        ? filters.dietary.filter(d => d !== option.key)
                        : [...filters.dietary, option.key]
                    });
                  }}
                  className={`p-3 border rounded-lg text-left hover:bg-neutral-50 ${
                    filters.dietary.includes(option.key) ? "border-primary-500 bg-primary-50" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{option.icon}</span>
                    <span className="font-medium">{option.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Spiciness Level */}
          <div className="mb-6">
            <h3 className="font-medium mb-3">Spiciness Level</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {spicyLevelOptions.map(option => (
                <button
                  key={option.key}
                  onClick={() => onChange({ ...filters, spicyLevel: option.key })}
                  className={`p-3 border rounded-lg text-left hover:bg-neutral-50 ${
                    filters.spicyLevel === option.key ? "border-primary-500 bg-primary-50" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{option.icon}</span>
                    <span className="font-medium">{option.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                onChange({
                  priceRange: "all",
                  dietary: [],
                  spicyLevel: "all"
                });
                onClose();
              }}
              className="px-4 py-2 text-neutral-700 hover:bg-neutral-100 rounded-lg"
            >
              Reset All
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-primary-600 text-white hover:bg-primary-700 rounded-lg"
            >
              Apply Filters
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
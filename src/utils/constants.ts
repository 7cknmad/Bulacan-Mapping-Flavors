// Dishes Page Constants
export type PriceRange = "all" | "budget" | "mid" | "premium";
export type DietaryOption = "vegetarian" | "vegan" | "halal" | "gluten_free";
export type SpicyLevel = "not_spicy" | "mild" | "medium" | "hot" | "very_hot";

export interface FilterOptions {
  priceRange: PriceRange;
  dietary: DietaryOption[];
  spicyLevel: SpicyLevel | "all";
}

export const categoryTabs = [
  { key: "all", label: "All" },
  { key: "food", label: "Food" },
  { key: "delicacy", label: "Delicacies" },
  { key: "drink", label: "Drinks" },
] as const;

export const priceRangeOptions = [
  { key: "all" as const, label: "All Prices", description: "Show all price ranges" },
  { key: "budget" as const, label: "Budget", description: "Under ₱100" },
  { key: "mid" as const, label: "Mid-Range", description: "₱100 - ₱300" },
  { key: "premium" as const, label: "Premium", description: "Above ₱300" }
] as const;

export const dietaryOptions = [
  { key: "vegetarian" as const, label: "Vegetarian", icon: "🥗" },
  { key: "vegan" as const, label: "Vegan", icon: "🌱" },
  { key: "halal" as const, label: "Halal", icon: "🌙" },
  { key: "gluten_free" as const, label: "Gluten Free", icon: "🌾" }
] as const;

export const spicyLevelOptions = [
  { key: "all" as const, label: "Any Spice Level", icon: "🌶️" },
  { key: "not_spicy" as const, label: "Not Spicy", icon: "😊" },
  { key: "mild" as const, label: "Mild", icon: "🌶️" },
  { key: "medium" as const, label: "Medium", icon: "🌶️🌶️" },
  { key: "hot" as const, label: "Hot", icon: "🌶️🌶️🌶️" },
  { key: "very_hot" as const, label: "Very Hot", icon: "🌶️🌶️🌶️🌶️" }
] as const;
import React, { useState } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard as LayoutDashboardIcon,
  BookOpen as BookOpenIcon,
  Utensils as UtensilsIcon,
  Users as UsersIcon,
  MessageSquare as MessageSquareIcon,
  BarChart as BarChartIcon,
  Settings as SettingsIcon,
  LogOut as LogOutIcon,
  ChevronRight as ChevronRightIcon,
  Plus as PlusIcon,
  Search as SearchIcon,
  Filter as FilterIcon,
  Star as StarIcon,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchMunicipalities,
  fetchDishes,
  fetchRestaurants,
  type Municipality,
  type Dish,
  type Restaurant,
} from "../utils/api";

function toArray(v: unknown): string[] {
  if (Array.isArray(v)) return v as string[];
  if (v == null) return [];
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed : (v.trim() ? [v] : []);
    } catch {
      return v.trim() ? [v] : [];
    }
  }
  return [];
}

const AdminOverview: React.FC = () => {
  const muniQ = useQuery<Municipality[]>({
    queryKey: ["admin-municipalities"],
    queryFn: fetchMunicipalities,
    staleTime: 60_000,
  });
  const dishesQ = useQuery<Dish[]>({
    queryKey: ["admin-dishes"],
    queryFn: () => fetchDishes(),
    staleTime: 60_000,
  });
  const restosQ = useQuery<Restaurant[]>({
    queryKey: ["admin-restaurants"],
    queryFn: () => fetchRestaurants(),
    staleTime: 60_000,
  });

  const muniCount = (muniQ.data ?? []).length;
  const dishCount = (dishesQ.data ?? []).length;
  const restoCount = (restosQ.data ?? []).length;

  const topDishes = [...(dishesQ.data ?? [])]
    .sort(
      (a, b) =>
        (Number(b.popularity ?? 0) - Number(a.popularity ?? 0)) ||
        (Number(b.rating ?? 0) - Number(a.rating ?? 0)) ||
        a.name.localeCompare(b.name)
    )
    .slice(0, 5);

  const topRestaurants = [...(restosQ.data ?? [])]
    .sort(
      (a, b) =>
        Number(b.rating ?? 0) - Number(a.rating ?? 0) ||
        a.name.localeCompare(b.name)
    )
    .slice(0, 5);

  return (
    <div>
      <h2 className="mb-6">Dashboard Overview</h2>

      {(muniQ.error || dishesQ.error || restosQ.error) && (
        <div className="mb-6 p-3 border border-red-200 bg-red-50 text-red-700 rounded">
          Some data failed to load. Make sure the API tunnel is running and VITE_API_URL points to the latest URL.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Dishes"
          value={dishesQ.isLoading ? "…" : String(dishCount)}
          icon={<BookOpenIcon size={20} className="text-primary-600" />}
          tone="primary"
        />
        <StatCard
          title="Total Restaurants"
          value={restosQ.isLoading ? "…" : String(restoCount)}
          icon={<UtensilsIcon size={20} className="text-secondary-600" />}
          tone="secondary"
        />
        <StatCard
          title="Municipalities"
          value={muniQ.isLoading ? "…" : String(muniCount)}
          icon={<LayoutDashboardIcon size={20} className="text-accent-600" />}
          tone="accent"
        />
        <StatCard
          title="Users"
          value="—"
          sub="(future)"
          icon={<UsersIcon size={20} className="text-neutral-600" />}
          tone="neutral"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Dishes */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">Popular Dishes</h3>
            <Link to="/dishes" className="text-primary-600 text-sm hover:underline">
              View All
            </Link>
          </div>
          <div className="space-y-4">
            {dishesQ.isLoading ? (
              <ListSkeleton />
            ) : (
              topDishes.map((d) => (
                <div key={d.id} className="flex items-center justify-between border-b border-neutral-100 pb-3">
                  <div>
                    <div className="font-medium">{d.name}</div>
                    <div className="text-xs text-neutral-500">
                      {d.municipality_name} • {d.category?.toUpperCase?.() ?? "—"}
                    </div>
                  </div>
                  <div className="flex items-center">
                    <StarIcon size={16} className="text-yellow-500 fill-yellow-500 mr-1" />
                    <span className="font-medium">
                      {Number(d.rating ?? 0).toFixed(1)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Restaurants */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">Top Restaurants</h3>
            <Link to="/restaurants" className="text-primary-600 text-sm hover:underline">
              View All
            </Link>
          </div>
          <div className="space-y-4">
            {restosQ.isLoading ? (
              <ListSkeleton />
            ) : (
              topRestaurants.map((r) => (
                <div key={r.id} className="flex items-center justify-between border-b border-neutral-100 pb-3">
                  <div>
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-neutral-500">
                      {(r.address || "").split(",")[0]} • {r.price_range ?? "—"}
                    </div>
                  </div>
                  <div className="flex items-center">
                    <StarIcon size={16} className="text-yellow-500 fill-yellow-500 mr-1" />
                    <span className="font-medium">
                      {Number(r.rating ?? 0).toFixed(1)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const AdminDishes: React.FC = () => {
  const dishesQ = useQuery<Dish[]>({
    queryKey: ["admin-dishes-table"],
    queryFn: () => fetchDishes(),
    staleTime: 60_000,
  });

  return (
    <div>
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6">
        <h2>Manage Dishes</h2>
        <Link to="/admin" className="btn btn-primary flex items-center mt-4 md:mt-0">
          <PlusIcon size={18} className="mr-2" />
          Quick Add (Admin)
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-grow">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <SearchIcon size={18} className="text-neutral-500" />
            </div>
            <input type="text" className="input pl-10" placeholder="Search dishes..." />
          </div>
          <button className="flex items-center justify-center px-4 py-2 bg-neutral-100 text-neutral-700 rounded-md hover:bg-neutral-200 transition-colors">
            <FilterIcon size={18} className="mr-2" />
            <span>Filters</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <TH>Dish</TH>
                <TH>Municipality</TH>
                <TH>Rating</TH>
                <TH>Popularity</TH>
                <TH right>Actions</TH>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {dishesQ.isLoading ? (
                <tr><td className="p-6 text-sm text-neutral-500" colSpan={5}>Loading…</td></tr>
              ) : (dishesQ.data ?? []).map((dish) => (
                <tr key={dish.id} className="hover:bg-neutral-50">
                  <td className="px-6 py-4">
                    <div className="font-medium">{dish.name}</div>
                    <div className="text-xs text-neutral-500">
                      {toArray(dish.ingredients).slice(0, 3).join(", ")}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span>{dish.municipality_name}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <StarIcon size={16} className="text-yellow-500 fill-yellow-500 mr-1" />
                      <span>{Number(dish.rating ?? 0).toFixed(1)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span>{Number(dish.popularity ?? 0)}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button className="text-primary-600 hover:text-primary-800 mr-3">Edit</button>
                    <button className="text-red-600 hover:text-red-800">Delete</button>
                  </td>
                </tr>
              ))}
              {(!dishesQ.isLoading && (dishesQ.data ?? []).length === 0) && (
                <tr><td className="p-6 text-sm text-neutral-500" colSpan={5}>No dishes yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const AdminRestaurants: React.FC = () => {
  const restosQ = useQuery<Restaurant[]>({
    queryKey: ["admin-restaurants-table"],
    queryFn: () => fetchRestaurants(),
    staleTime: 60_000,
  });

  return (
    <div>
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6">
        <h2>Manage Restaurants</h2>
        <Link to="/admin" className="btn btn-primary flex items-center mt-4 md:mt-0">
          <PlusIcon size={18} className="mr-2" />
          Quick Add (Admin)
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-grow">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <SearchIcon size={18} className="text-neutral-500" />
            </div>
            <input type="text" className="input pl-10" placeholder="Search restaurants..." />
          </div>
          <button className="flex items-center justify-center px-4 py-2 bg-neutral-100 text-neutral-700 rounded-md hover:bg-neutral-200 transition-colors">
            <FilterIcon size={18} className="mr-2" />
            <span>Filters</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <TH>Restaurant</TH>
                <TH>Location</TH>
                <TH>Rating</TH>
                <TH>Price</TH>
                <TH right>Actions</TH>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {restosQ.isLoading ? (
                <tr><td className="p-6 text-sm text-neutral-500" colSpan={5}>Loading…</td></tr>
              ) : (restosQ.data ?? []).map((r) => (
                <tr key={r.id} className="hover:bg-neutral-50">
                  <td className="px-6 py-4">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-neutral-500">
                      {toArray((r as any).cuisine_types).slice(0, 3).join(", ") || "—"}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span>{(r.address || "").split(",")[0]}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <StarIcon size={16} className="text-yellow-500 fill-yellow-500 mr-1" />
                      <span>{Number(r.rating ?? 0).toFixed(1)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span>{r.price_range ?? "—"}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button className="text-primary-600 hover:text-primary-800 mr-3">Edit</button>
                    <button className="text-red-600 hover:text-red-800">Delete</button>
                  </td>
                </tr>
              ))}
              {(!restosQ.isLoading && (restosQ.data ?? []).length === 0) && (
                <tr><td className="p-6 text-sm text-neutral-500" colSpan={5}>No restaurants yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};


const AdminReviews: React.FC = () => {
  return (
    <div>
      <h2 className="mb-6">Manage Reviews</h2>
      <div className="p-4 bg-neutral-50 border rounded text-neutral-600">
        Reviews API isn’t implemented yet. Coming soon.
      </div>
    </div>
  );
};

const AdminAnalytics: React.FC = () => {
  return (
    <div>
      <h2 className="mb-6">Analytics</h2>
      <div className="p-4 bg-neutral-50 border rounded text-neutral-600">
        Analytics dashboards will appear here. (No mock data.)
      </div>
    </div>
  );
};

/* ================= Settings (static) ================= */
const AdminSettings: React.FC = () => {
  return (
    <div>
      <h2 className="mb-6">Settings</h2>
      <div className="bg-white rounded-lg shadow-sm p-6">
        <p className="text-neutral-600">Project settings will live here.</p>
      </div>
    </div>
  );
};

/* ================= Layout Shell ================= */
const TH: React.FC<{ children: React.ReactNode; right?: boolean }> = ({ children, right }) => (
  <th
    scope="col"
    className={`px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider ${
      right ? "text-right" : ""
    }`}
  >
    {children}
  </th>
);

const StatCard = ({
  title,
  value,
  sub,
  icon,
  tone = "primary",
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  tone?: "primary" | "secondary" | "accent" | "neutral";
}) => {
  const toneMap: Record<string, string> = {
    primary: "bg-primary-100",
    secondary: "bg-secondary-100",
    accent: "bg-accent-100",
    neutral: "bg-neutral-100",
  };
  const color = toneMap[tone] ?? toneMap.primary;
  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium">{title}</h3>
        <div className={`w-10 h-10 rounded-full ${color} flex items-center justify-center`}>
          {icon}
        </div>
      </div>
      <p className="text-3xl font-bold">{value}</p>
      {sub && <p className="text-sm text-neutral-500 mt-2">{sub}</p>}
    </div>
  );
};

const AdminDashboard: React.FC = () => {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="pt-16 bg-neutral-50 min-h-screen">
      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-10 w-64 bg-white border-r border-neutral-200 pt-20 transform transition-transform duration-300 ease-in-out ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          } md:relative md:translate-x-0`}
        >
          <div className="p-4">
            <div className="mb-6">
              <div className="flex items-center mb-4">
                <img
                  src="https://via.placeholder.com/40"
                  alt="Admin"
                  className="w-10 h-10 rounded-full mr-3"
                />
                <div>
                  <div className="font-medium">Admin User</div>
                  <div className="text-xs text-neutral-500">Administrator</div>
                </div>
              </div>
            </div>
            <nav className="space-y-1">
              <Link
                to="/admin"
                className={`flex items-center px-4 py-2 rounded-md ${
                  location.pathname === "/admin"
                    ? "bg-primary-50 text-primary-600"
                    : "text-neutral-700 hover:bg-neutral-100"
                }`}
              >
                <LayoutDashboardIcon size={20} className="mr-3" />
                <span>Dashboard</span>
              </Link>
              <Link
                to="/admin/dishes"
                className={`flex items-center px-4 py-2 rounded-md ${
                  location.pathname === "/admin/dishes"
                    ? "bg-primary-50 text-primary-600"
                    : "text-neutral-700 hover:bg-neutral-100"
                }`}
              >
                <BookOpenIcon size={20} className="mr-3" />
                <span>Dishes</span>
              </Link>
              <Link
                to="/admin/restaurants"
                className={`flex items-center px-4 py-2 rounded-md ${
                  location.pathname === "/admin/restaurants"
                    ? "bg-primary-50 text-primary-600"
                    : "text-neutral-700 hover:bg-neutral-100"
                }`}
              >
                <UtensilsIcon size={20} className="mr-3" />
                <span>Restaurants</span>
              </Link>
              <Link
                to="/admin/reviews"
                className={`flex items-center px-4 py-2 rounded-md ${
                  location.pathname === "/admin/reviews"
                    ? "bg-primary-50 text-primary-600"
                    : "text-neutral-700 hover:bg-neutral-100"
                }`}
              >
                <MessageSquareIcon size={20} className="mr-3" />
                <span>Reviews</span>
              </Link>
              <Link
                to="/admin/analytics"
                className={`flex items-center px-4 py-2 rounded-md ${
                  location.pathname === "/admin/analytics"
                    ? "bg-primary-50 text-primary-600"
                    : "text-neutral-700 hover:bg-neutral-100"
                }`}
              >
                <BarChartIcon size={20} className="mr-3" />
                <span>Analytics</span>
              </Link>
              <Link
                to="/admin/settings"
                className={`flex items-center px-4 py-2 rounded-md ${
                  location.pathname === "/admin/settings"
                    ? "bg-primary-50 text-primary-600"
                    : "text-neutral-700 hover:bg-neutral-100"
                }`}
              >
                <SettingsIcon size={20} className="mr-3" />
                <span>Settings</span>
              </Link>
            </nav>
            <div className="mt-8 pt-4 border-t border-neutral-200">
              <Link
                to="/"
                className="flex items-center px-4 py-2 rounded-md text-neutral-700 hover:bg-neutral-100"
              >
                <LogOutIcon size={20} className="mr-3" />
                <span>Back to Site</span>
              </Link>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 p-6 md:ml-64">
          {/* Breadcrumb */}
          <div className="mb-6 flex items-center text-sm text-neutral-500">
            <Link to="/admin" className="hover:text-primary-600">
              Admin
            </Link>
            <ChevronRightIcon size={16} className="mx-1" />
            <span className="font-medium text-neutral-700">
              {location.pathname === "/admin" && "Dashboard"}
              {location.pathname === "/admin/dishes" && "Dishes"}
              {location.pathname === "/admin/restaurants" && "Restaurants"}
              {location.pathname === "/admin/reviews" && "Reviews"}
              {location.pathname === "/admin/analytics" && "Analytics"}
              {location.pathname === "/admin/settings" && "Settings"}
            </span>
          </div>

          {/* Content Router */}
          <Routes>
            <Route path="/" element={<AdminOverview />} />
            <Route path="/dishes" element={<AdminDishes />} />
            <Route path="/restaurants" element={<AdminRestaurants />} />
            <Route path="/reviews" element={<AdminReviews />} />
            <Route path="/analytics" element={<AdminAnalytics />} />
            <Route path="/settings" element={<AdminSettings />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;

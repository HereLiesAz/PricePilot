import { useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { HomePage } from "@/pages/HomePage";
import { ListDetailPage } from "@/pages/ListDetailPage";
import { SearchPage } from "@/pages/SearchPage";
import { AboutPage } from "@/pages/AboutPage";
import { useAppStore } from "@/store/useAppStore";

export function App() {
  const theme = useAppStore((s) => s.theme);

  // Reflect the persisted theme on <html> so Tailwind's dark variant applies.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="lists/:id" element={<ListDetailPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="about" element={<AboutPage />} />
      </Route>
    </Routes>
  );
}

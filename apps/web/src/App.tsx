import { useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { HomePage } from "@/pages/HomePage";
import { ListDetailPage } from "@/pages/ListDetailPage";
import { SearchPage } from "@/pages/SearchPage";
import { AboutPage } from "@/pages/AboutPage";
import { LoginPage } from "@/pages/LoginPage";
import { useAppStore } from "@/store/useAppStore";
import { useAuthStore } from "@/store/useAuthStore";

export function App() {
  const theme = useAppStore((s) => s.theme);
  const token = useAuthStore((s) => s.token);

  // Reflect the persisted theme on <html> so Tailwind's dark variant applies.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  // All data lives behind auth — show the login screen until signed in.
  if (!token) return <LoginPage />;

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

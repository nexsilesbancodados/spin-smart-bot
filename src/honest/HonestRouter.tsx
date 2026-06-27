import { Route, Routes } from "react-router-dom";
import HonestyLayout from "./components/HonestyLayout";
import Dashboard from "./pages/Dashboard";

export default function HonestRouter() {
  return (
    <Routes>
      <Route element={<HonestyLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="*" element={<Dashboard />} />
      </Route>
    </Routes>
  );
}

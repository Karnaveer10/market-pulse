import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "./components/AppLayout";
import AwsAuthGate from "./components/AwsAuthGate";
import DashboardPage from "./pages/DashboardPage";
import ProductsPage from "./pages/ProductsPage";
import CampaignsPage from "./pages/CampaignsPage";
import CustomersPage from "./pages/CustomersPage";
import ChannelsPage from "./pages/ChannelsPage";
import InteractionsPage from "./pages/InteractionsPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import StorefrontPage from "./pages/StorefrontPage";
import NotFound from "./pages/NotFound";
import { seedIndianDataIfEmpty } from "./lib/indian-data-seeder";
import { isAwsDataApiConfigured } from "@/lib/aws-data-api";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    // Keep the local Supabase demo seeder out of AWS configured deployments.
    if (!isAwsDataApiConfigured()) seedIndianDataIfEmpty();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Standalone Realistic Customer Website */}
          <Route path="/store" element={<StorefrontPage />} />

          {/* Admin Dashboard & Analytics Layout */}
          <Route element={<AwsAuthGate><AppLayout /></AwsAuthGate>}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/campaigns" element={<CampaignsPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/channels" element={<ChannelsPage />} />
            <Route path="/interactions" element={<InteractionsPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;

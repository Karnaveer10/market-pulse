import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag, CheckCircle2, ArrowRight, Sparkles, Tag, Users,
  MousePointerClick, CreditCard, ChevronRight, Activity, Eye, ShieldCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useProducts, type Product } from '@/hooks/use-products';
import { useCampaigns } from '@/hooks/use-campaigns';
import { useChannels } from '@/hooks/use-channels';
import { dispatchTelemetryEvent } from '@/lib/telemetry-service';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import XRayTraceModal from '@/components/XRayTraceModal';

export default function StorefrontPage() {
  const queryClient = useQueryClient();
  const { data: products = [] } = useProducts();
  const { data: campaigns = [] } = useCampaigns();
  const { data: channels = [] } = useChannels();

  // State for simulated marketing attribution context
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');

  // Cart & Order state
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [xrayModalOpen, setXrayModalOpen] = useState(false);
  const [lastActionToast, setLastActionToast] = useState<string>('');

  // Lead capture form state
  const [leadForm, setLeadForm] = useState({ name: '', email: '', phone: '' });

  // Fallbacks if tables are still populating
  const activeCampaign = campaigns.find(c => c.id === selectedCampaignId) || campaigns[0];
  const activeChannel = channels.find(c => c.id === selectedChannelId) || channels[0];

  const showNotification = (msg: string) => {
    setLastActionToast(msg);
    setTimeout(() => setLastActionToast(''), 4000);
  };

  // 1. Telemetry: Visit
  const handleProductView = async (product: Product) => {
    await dispatchTelemetryEvent({
      type: 'visit',
      product_id: product.id,
      product_name: product.name,
      campaign_id: activeCampaign?.id,
      campaign_name: activeCampaign?.name || 'Default Promo',
      channel_id: activeChannel?.id,
      channel_name: activeChannel?.name || 'Direct Web',
    });

    // Also record in supabase
    await supabase.from('interactions').insert({
      type: 'visit',
      revenue: 0,
      product_id: product.id,
      campaign_id: activeCampaign?.id || null,
      channel_id: activeChannel?.id || null,
      date: new Date().toISOString().split('T')[0],
    });

    queryClient.invalidateQueries({ queryKey: ['interactions'] });
    showNotification(`Telemetry Sent: "Visit" on ${product.name} (AWS SQS Enqueued)`);
  };

  // 2. Telemetry: Click (Ad/Deal CTA click -> CPC consumption)
  const handleAdBannerClick = async () => {
    await dispatchTelemetryEvent({
      type: 'click',
      campaign_id: activeCampaign?.id,
      campaign_name: activeCampaign?.name || 'Social Blitz',
      channel_id: activeChannel?.id,
      channel_name: activeChannel?.name || 'Google Ads',
      cost: 1.5, // CPC $1.50
    });

    await supabase.from('interactions').insert({
      type: 'click',
      revenue: 0,
      campaign_id: activeCampaign?.id || null,
      channel_id: activeChannel?.id || null,
      date: new Date().toISOString().split('T')[0],
    });

    queryClient.invalidateQueries({ queryKey: ['interactions'] });
    showNotification(`Telemetry Sent: "Click" registered! (Consumed $1.50 CPC budget)`);
  };

  // 3. Telemetry: Lead Capture Signup
  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadForm.name || !leadForm.email) return;

    // Insert new customer into supabase
    const { data: newCust } = await supabase.from('customers').insert({
      name: leadForm.name,
      email: leadForm.email,
      phone: leadForm.phone || null,
    }).select().single();

    await dispatchTelemetryEvent({
      type: 'lead',
      customer_name: leadForm.name,
      customer_email: leadForm.email,
      customer_phone: leadForm.phone,
      campaign_id: activeCampaign?.id,
      campaign_name: activeCampaign?.name,
    });

    queryClient.invalidateQueries({ queryKey: ['customers'] });
    setLeadModalOpen(false);
    setLeadForm({ name: '', email: '', phone: '' });
    showNotification(`New Customer Created in DB: ${leadForm.name} (+1 Lead)`);
  };

  // 4. Telemetry: Add to Cart
  const handleAddToCart = async (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { product, quantity: 1 }];
    });

    await dispatchTelemetryEvent({
      type: 'cart_add',
      product_id: product.id,
      product_name: product.name,
      campaign_id: activeCampaign?.id,
      channel_id: activeChannel?.id,
      revenue: product.price,
    });

    showNotification(`Cart Intent: Added "${product.name}" to cart ($${product.price})`);
  };

  // 5. Telemetry: Checkout & Purchase ($ Revenue Pulse!)
  const handleCompleteCheckout = async () => {
    if (cart.length === 0) return;
    const totalOrderRevenue = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    const primaryProduct = cart[0].product;

    // Relational write to Supabase interactions table
    await supabase.from('interactions').insert({
      type: 'purchase',
      revenue: totalOrderRevenue,
      product_id: primaryProduct.id,
      campaign_id: activeCampaign?.id || null,
      channel_id: activeChannel?.id || null,
      date: new Date().toISOString().split('T')[0],
    });

    await dispatchTelemetryEvent({
      type: 'purchase',
      product_id: primaryProduct.id,
      product_name: primaryProduct.name,
      campaign_id: activeCampaign?.id,
      campaign_name: activeCampaign?.name,
      channel_id: activeChannel?.id,
      channel_name: activeChannel?.name,
      revenue: totalOrderRevenue,
    });

    queryClient.invalidateQueries({ queryKey: ['interactions'] });
    queryClient.invalidateQueries({ queryKey: ['campaigns'] });

    setCart([]);
    setCheckoutModalOpen(false);
    setOrderComplete(true);
    showNotification(`🎉 Purchase Complete! +$${totalOrderRevenue.toLocaleString()} Revenue Added to DB!`);
  };

  const totalCartValue = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  return (
    <div className="space-y-6">
      {/* Live Simulation Top Toolbar */}
      <div className="bg-card border border-primary/20 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-foreground">Live Customer Storefront Simulator</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" /> Real-Time Telemetry
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Interact with this customer portal to fire live AWS SQS $\rightarrow$ Lambda $\rightarrow$ RDS + Redis events.
            </p>
          </div>
        </div>

        {/* Marketing Attribution Selectors & X-Ray Button */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <select
            value={selectedCampaignId}
            onChange={(e) => setSelectedCampaignId(e.target.value)}
            className="bg-muted border border-border text-xs rounded-lg px-2.5 py-1.5 outline-none font-medium"
          >
            <option value="">Attribution: {activeCampaign?.name || 'Select Campaign'}</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select
            value={selectedChannelId}
            onChange={(e) => setSelectedChannelId(e.target.value)}
            className="bg-muted border border-border text-xs rounded-lg px-2.5 py-1.5 outline-none font-medium"
          >
            <option value="">Channel: {activeChannel?.name || 'Select Channel'}</option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setXrayModalOpen(true)}
            className="gap-1.5 text-xs border-amber-500/30 text-amber-500 hover:bg-amber-500/10"
          >
            <Activity className="w-3.5 h-3.5 animate-pulse" /> AWS X-Ray Traces
          </Button>
        </div>
      </div>

      {/* Floating Action Toast */}
      <AnimatePresence>
        {lastActionToast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 rounded-xl text-xs font-semibold flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{lastActionToast}</span>
            </div>
            <button onClick={() => setXrayModalOpen(true)} className="underline hover:text-emerald-400 text-[11px]">
              View Trace Timeline &rarr;
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Ad Banner (Demonstrating Interaction #2: Ad Click) */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-primary/20 via-primary/10 to-card border border-border p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/20 text-primary border border-primary/30">
            <Sparkles className="w-3.5 h-3.5" /> Special Campaign Deal: 25% Off Enterprise Suite
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Accelerate Your Business with MarketPulse Cloud Products
          </h2>
          <p className="text-xs md:text-sm text-muted-foreground">
            Attributed to active campaign <span className="font-semibold text-foreground">{activeCampaign?.name || 'Spring Launch'}</span> via channel <span className="font-semibold text-foreground">{activeChannel?.name || 'Google Ads'}</span>.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Button onClick={handleAdBannerClick} className="gap-2 shadow-lg shadow-primary/20">
            <MousePointerClick className="w-4 h-4" /> Simulate Ad CTA Click
          </Button>
          <Button variant="outline" onClick={() => setLeadModalOpen(true)} className="gap-2">
            <Tag className="w-4 h-4" /> Get 15% VIP Coupon
          </Button>
        </div>
      </div>

      {/* Product Catalog Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">Available Products & Offerings</h3>
            <p className="text-xs text-muted-foreground">Click a product card to test "Visit", or add to cart for checkout</p>
          </div>
          {cart.length > 0 && (
            <Button onClick={() => setCheckoutModalOpen(true)} className="gap-2">
              <ShoppingBag className="w-4 h-4" />
              Checkout ({cart.reduce((s, i) => s + i.quantity, 0)}) • ${totalCartValue}
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product) => (
            <motion.div
              key={product.id}
              whileHover={{ y: -3 }}
              className="bg-card border border-border rounded-xl p-5 flex flex-col justify-between shadow-sm hover:border-primary/50 transition"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                    {product.category}
                  </span>
                  <span className="text-lg font-bold text-foreground font-mono">
                    ${product.price}
                  </span>
                </div>
                <h4 className="font-semibold text-base text-card-foreground">{product.name}</h4>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  High-performance enterprise solution with seamless marketing telemetry integration.
                </p>
              </div>

              <div className="pt-4 border-t border-border mt-4 flex items-center justify-between gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleProductView(product)}
                  className="text-xs text-muted-foreground gap-1"
                >
                  <Eye className="w-3.5 h-3.5" /> View Details
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleAddToCart(product)}
                  className="text-xs gap-1.5"
                >
                  Add to Cart
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Lead Capture Modal */}
      {leadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <h3 className="text-base font-bold">VIP 15% Discount Signup</h3>
              </div>
              <button onClick={() => setLeadModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                ✕
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Submitting this form triggers a live telemetry "Lead" event and creates a new customer profile in the database.
            </p>

            <form onSubmit={handleLeadSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-medium">Full Name</label>
                <Input
                  required
                  placeholder="e.g. Sarah Jenkins"
                  value={leadForm.name}
                  onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium">Work Email</label>
                <Input
                  required
                  type="email"
                  placeholder="sarah@company.com"
                  value={leadForm.email}
                  onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium">Phone (Optional)</label>
                <Input
                  placeholder="+1 (555) 019-2834"
                  value={leadForm.phone}
                  onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                />
              </div>
              <div className="pt-2 flex items-center justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setLeadModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Register Lead & Claim 15%
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Checkout Drawer / Modal */}
      {checkoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-500" />
                <h3 className="text-base font-bold">1-Click Order Checkout</h3>
              </div>
              <button onClick={() => setCheckoutModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                ✕
              </button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto divide-y divide-border">
              {cart.map((item, idx) => (
                <div key={idx} className="py-2 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-foreground">{item.product.name}</div>
                    <div className="text-muted-foreground">Qty: {item.quantity} × ${item.product.price}</div>
                  </div>
                  <span className="font-mono font-bold">${item.product.price * item.quantity}</span>
                </div>
              ))}
            </div>

            <div className="p-3 bg-muted/40 rounded-xl space-y-1 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Attributed Campaign:</span>
                <span className="font-medium text-foreground">{activeCampaign?.name || 'Organic / None'}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Attributed Channel:</span>
                <span className="font-medium text-foreground">{activeChannel?.name || 'Direct Web'}</span>
              </div>
              <div className="flex justify-between text-sm font-bold pt-2 border-t border-border">
                <span>Total Order Value:</span>
                <span className="text-emerald-500 font-mono">${totalCartValue}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setCheckoutModalOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleCompleteCheckout} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                <ShieldCheck className="w-4 h-4" /> Place Order & Fire Telemetry
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* X-Ray Distributed Trace Modal */}
      <XRayTraceModal isOpen={xrayModalOpen} onClose={() => setXrayModalOpen(false)} />
    </div>
  );
}

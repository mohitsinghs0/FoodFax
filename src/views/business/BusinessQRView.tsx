import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { BusinessLayout } from '../../components/business/BusinessLayout';
import { shopService } from '../../services/shopService';
import { Shop } from '../../types';
import { QrCode, Printer, Download, Copy, Check, Store, Utensils } from 'lucide-react';

export const BusinessQRView: React.FC = () => {
  const { currentBusiness, activeShopId } = useAuth();
  const targetShopId = activeShopId || currentBusiness?.id || 'demo-shop-001';

  const [shop, setShop] = useState<Shop | null>(null);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const load = async () => {
      const s = await shopService.getShop(targetShopId);
      if (s) setShop(s);
    };
    load();
  }, [targetShopId]);

  const baseUrl = window.location.origin;
  const qrTargetUrl = selectedTable
    ? `${baseUrl}/shop/${shop?.slug || targetShopId}?table=${encodeURIComponent(selectedTable)}`
    : `${baseUrl}/shop/${shop?.slug || targetShopId}`;

  // Use reliable quickchart / qrserver SVG/PNG generator
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrTargetUrl)}&margin=10`;

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(qrTargetUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <BusinessLayout activeTab="qr">
      <div className="max-w-xl mx-auto space-y-6 pb-20">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <QrCode className="w-5 h-5 text-orange-500" />
            Counter & Table QR Poster
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Print and stick this QR on your stall counter or tables. Customers scan with their phone camera to view your menu and get live tokens!
          </p>
        </div>

        {/* Table Selector */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex items-center justify-between gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-800">
              Generate QR for:
            </label>
            <p className="text-[11px] text-slate-400">Main counter or specific table</p>
          </div>

          <select
            value={selectedTable}
            onChange={(e) => setSelectedTable(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
          >
            <option value="">Main Stall Counter</option>
            <option value="Table 1">Table 1</option>
            <option value="Table 2">Table 2</option>
            <option value="Table 3">Table 3</option>
            <option value="Table 4">Table 4</option>
            <option value="Table 5">Table 5</option>
            <option value="Counter Seat A">Counter Seat A</option>
            <option value="Counter Seat B">Counter Seat B</option>
          </select>
        </div>

        {/* Printable Standee Card */}
        <div className="bg-white rounded-3xl border-2 border-orange-500/30 p-6 sm:p-8 shadow-md text-center space-y-4 max-w-sm mx-auto print:border-none print:shadow-none">
          <div className="flex items-center justify-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-500 text-white flex items-center justify-center font-bold">
              <Store className="w-4 h-4" />
            </div>
            <h2 className="font-black text-lg text-slate-900">{shop?.name || 'Food Stall'}</h2>
          </div>

          <div className="p-3 bg-orange-50 rounded-xl inline-block">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-orange-800">
              {selectedTable ? `Direct Dine-In • ${selectedTable}` : 'Scan to Order & Get Digital Token'}
            </span>
          </div>

          {/* QR Image */}
          <div className="w-56 h-56 mx-auto bg-white p-2 rounded-2xl border border-slate-200 shadow-inner flex items-center justify-center">
            <img
              src={qrImageUrl}
              alt="Stall Menu QR"
              className="w-full h-full object-contain rounded-xl"
            />
          </div>

          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-800">
              1. Open Camera or Google Lens
            </p>
            <p className="text-xs font-bold text-slate-800">
              2. Scan QR to open stall menu
            </p>
            <p className="text-xs font-bold text-slate-800">
              3. Get live digital token on your phone!
            </p>
          </div>

          <p className="text-[10px] text-slate-400 font-medium">Powered by FoodFlow</p>
        </div>

        {/* Print & Link Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="flex-1 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print QR Poster</span>
          </button>

          <button
            onClick={handleCopyLink}
            className="flex-1 py-3 px-4 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 font-bold text-xs shadow-2xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
            <span>{copied ? 'Copied Link!' : 'Copy Menu URL'}</span>
          </button>
        </div>
      </div>
    </BusinessLayout>
  );
};

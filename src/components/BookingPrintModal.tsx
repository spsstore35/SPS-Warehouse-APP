import React, { useState } from 'react';
import { Booking } from '../types/inventory';
import {
  Printer,
  Download,
  X,
  FileText,
  Factory,
  Phone,
  Mail,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

interface BookingPrintModalProps {
  booking: Booking | null;
  isOpen: boolean;
  onClose: () => void;
  defaultDocType?: 'quotation' | 'production';
}

export const BookingPrintModal: React.FC<BookingPrintModalProps> = ({
  booking,
  isOpen,
  onClose,
  defaultDocType = 'quotation',
}) => {
  const [docType, setDocType] = useState<'quotation' | 'production'>(defaultDocType);
  const previewScale = '0.75';
  const [includeNotes, setIncludeNotes] = useState<boolean>(
    Boolean(booking?.notes && booking.notes.trim().length > 0)
  );
  const [isDownloading, setIsDownloading] = useState(false);

  if (!isOpen || !booking) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    const element = document.getElementById('printable-a4-area');
    if (!element) {
      window.print();
      return;
    }
    setIsDownloading(true);
    try {
      const html2pdfModule = await import('html2pdf.js');
      const html2pdf = html2pdfModule.default || html2pdfModule;

      const opt = {
        margin: [4, 6, 4, 6] as [number, number, number, number],
        filename: `${docType === 'quotation' ? 'Quotation' : 'Workshop_Sheet'}_${booking.bookingNumber}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
      };

      await html2pdf().set(opt).from(element).save();
    } catch (err) {
      console.warn('Direct PDF export error, falling back to print dialog:', err);
      window.print();
    } finally {
      setIsDownloading(false);
    }
  };

  const totalUnits = booking.items.reduce((acc, it) => acc + it.quantity, 0);
  const totalDeficit = booking.items.reduce((acc, it) => acc + it.deficitQuantity, 0);
  const totalRecommendedProduction = booking.items.reduce(
    (acc, it) => acc + (it.recommendedProduction || it.deficitQuantity),
    0
  );

  const depositPct = booking.depositPercentage ?? (booking.depositRate ? Math.round(booking.depositRate * 100) : 50);
  const remainingPct = Math.max(0, 100 - depositPct);

  return (
    <div
      id="print-modal-container"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 overflow-hidden print:static print:inset-auto print:bg-white print:p-0 print:m-0 print:overflow-visible print:block"
    >
      {/* Modal Container: Fullscreen on mobile, rounded card on desktop */}
      <div className="w-full h-full sm:h-auto sm:max-h-[96vh] sm:max-w-4xl bg-slate-100 sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden print:bg-white print:max-h-none print:h-auto print:border-none print:shadow-none print:rounded-none print:overflow-visible print:w-full print:m-0">
        
        {/* Top Control Bar: Streamlined, Mobile-Optimized (Hidden strictly when printing) */}
        <div className="no-print print:hidden bg-slate-950 text-white p-3 sm:p-4 shrink-0 border-b border-slate-800 shadow-md">
          {/* Top Row: Title, Serial Badge & Close Button */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                <Printer className="w-4 h-4 text-amber-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-black text-white truncate">Print Document</span>
                  <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 font-black shrink-0">
                    {booking.bookingNumber}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 text-white flex items-center justify-center transition-colors shrink-0"
              title="Close Preview"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>

          {/* Controls Row: Document Switcher, Notes & Print Action */}
          <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
            {/* Segmented Document Switcher */}
            <div className="inline-flex p-1 bg-slate-900 rounded-xl border border-slate-800 flex-1 sm:flex-none">
              <button
                type="button"
                onClick={() => setDocType('quotation')}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  docType === 'quotation'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Quotation</span>
              </button>

              <button
                type="button"
                onClick={() => setDocType('production')}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  docType === 'production'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Factory className="w-3.5 h-3.5" />
                <span>Workshop Deficit</span>
              </button>
            </div>

            {/* Notes Toggle (Only for Client Quotation sheet, not Workshop Deficit) */}
            {docType === 'quotation' && booking.notes && (
              <button
                type="button"
                onClick={() => setIncludeNotes(!includeNotes)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors flex items-center gap-1.5 ${
                  includeNotes
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
                title="Toggle displaying notes in print/PDF"
              >
                <FileText className="w-3 h-3" />
                <span>{includeNotes ? '✓ Notes Included' : 'Notes Excluded'}</span>
              </button>
            )}

            {/* Download PDF Action */}
            <button
              type="button"
              disabled={isDownloading}
              onClick={handleDownloadPdf}
              className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              title="Download PDF Document File"
            >
              {isDownloading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Download className="w-4 h-4 stroke-[2.5]" />
              )}
              <span>{isDownloading ? 'Downloading...' : 'Download PDF'}</span>
            </button>

            {/* Primary Print Action */}
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4 stroke-[2.5]" />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* Preview Scrollable Viewport - Smooth Scrolling on Mobile */}
        <div className="flex-1 overflow-y-auto overflow-x-auto p-2 sm:p-6 bg-slate-100/90 print:bg-white print:p-0 print:overflow-visible flex flex-col items-center">
          {/* Embedded Print Stylesheet for Guaranteed Strict 1-Page A4 Output */}
          <style dangerouslySetInnerHTML={{
            __html: `
              @media print {
                @page {
                  size: A4 portrait;
                  margin: 8mm 10mm;
                }
                *, *::before, *::after {
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                html, body {
                  background: #ffffff !important;
                  color: #0f172a !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  width: 100% !important;
                  height: auto !important;
                  overflow: visible !important;
                }
                .no-print,
                .print\\:hidden,
                button,
                nav,
                header,
                footer,
                aside,
                [role="navigation"] {
                  display: none !important;
                }
                #printable-a4-area {
                  zoom: 1 !important;
                  transform: none !important;
                  border: none !important;
                  box-shadow: none !important;
                  padding: 0 !important;
                  margin: 0 !important;
                  width: 100% !important;
                  max-width: 100% !important;
                  background: #ffffff !important;
                  page-break-after: avoid !important;
                  page-break-inside: avoid !important;
                  break-after: avoid !important;
                  break-inside: avoid !important;
                }
                .sheet-card {
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                }
              }
            `
          }} />

          {/* A4 Sheet Simulation Canvas */}
          <div
            id="printable-a4-area"
            style={{
              zoom: previewScale === '0.75' ? 0.75 : 1.0,
            }}
            className="w-full max-w-[210mm] mx-auto bg-white border border-slate-200/90 shadow-xl rounded-xl sm:rounded-2xl p-3.5 sm:p-7 font-sans text-slate-900 print:border-none print:shadow-none print:rounded-none print:p-0 print:m-0 print:w-full print:max-w-none text-xs leading-relaxed transition-all"
          >
            {/* ============================================================== */}
            {/* DOCUMENT 1: OFFICIAL CLIENT QUOTATION (STRICT 1-PAGE A4)       */}
            {/* ============================================================== */}
            {docType === 'quotation' && (
              <div className="space-y-3.5 sm:space-y-4">
                {/* Header: Company Name, Phone, Email & Quotation Tag */}
                <div className="sheet-card flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b-2 border-slate-900 pb-3">
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-white border border-slate-200/90 shadow-2xs p-1 flex items-center justify-center shrink-0 overflow-hidden">
                      <img
                        src="/sps-logo.png"
                        alt="Saint Paul Scouts"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div>
                      <h1 className="text-lg sm:text-2xl font-black tracking-tight text-slate-950 uppercase leading-tight">
                        SAINT PAUL SCOUTS WAREHOUSE
                      </h1>
                      <div className="text-[11px] sm:text-xs text-slate-600 flex flex-wrap items-center gap-2.5 sm:gap-4 mt-1 font-medium">
                        <span className="flex items-center gap-1.5 font-bold text-slate-800">
                          <Phone className="w-3.5 h-3.5 text-slate-500" />
                          <span>01212101148</span>
                        </span>
                        <span className="flex items-center gap-1.5 font-bold text-slate-800">
                          <Mail className="w-3.5 h-3.5 text-slate-500" />
                          <span>spsstore35@gmail.com</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-left sm:text-right flex sm:flex-col justify-between items-start sm:items-end">
                    <span className="inline-block px-3 py-1 rounded bg-blue-50 text-blue-900 border border-blue-200 font-mono font-black text-xs uppercase tracking-wider mb-1">
                      OFFICIAL QUOTATION
                    </span>
                    <div>
                      <div className="font-mono font-black text-sm sm:text-base text-slate-900">
                        {booking.bookingNumber}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Date:{' '}
                        <span className="font-bold text-slate-800">
                          {new Date(booking.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quotation Info: Client & Terms Card */}
                <div className="sheet-card grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50/80 border border-slate-200 rounded-xl sm:rounded-2xl p-3 sm:p-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider font-black text-slate-400 mb-1">
                      QUOTATION PREPARED FOR
                    </div>
                    <div className="text-base font-black text-slate-900">{booking.clientName}</div>
                    <div className="text-xs text-slate-600 mt-0.5 font-medium">
                      Phone: <span className="font-semibold text-slate-800">{booking.clientPhone}</span>
                    </div>
                    {includeNotes && booking.notes && (
                      <div className="text-xs text-slate-700 mt-1.5 italic bg-white/90 p-2 rounded-lg border border-slate-200/80">
                        <strong className="text-slate-900 not-italic">Notes:</strong> {booking.notes}
                      </div>
                    )}
                  </div>

                  <div className="sm:text-right flex flex-col justify-between sm:items-end">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider font-black text-slate-400 mb-1">
                        STATUS & PAYMENT TERMS
                      </div>
                      <div>
                        <span
                          className={`inline-block px-3 py-1 rounded-lg font-black text-xs uppercase tracking-wider border ${
                            booking.status === 'pending'
                              ? 'bg-amber-100/90 text-amber-950 border-amber-300'
                              : booking.status === 'preparing'
                              ? 'bg-blue-100 text-blue-950 border-blue-300'
                              : booking.status === 'delivered'
                              ? 'bg-purple-100 text-purple-950 border-purple-300'
                              : 'bg-emerald-100 text-emerald-950 border-emerald-300'
                          }`}
                        >
                          {booking.status === 'pending'
                            ? (depositPct === 100 ? 'AWAITING FULL PAYMENT' : `AWAITING ${depositPct}% DEPOSIT`)
                            : booking.status === 'preparing'
                            ? 'IN PREPARATION / STOCK RESERVED'
                            : booking.status === 'delivered'
                            ? 'DELIVERED (AWAITING BALANCE)'
                            : '✓ 100% FULLY PAID & SETTLED'}
                        </span>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-2">
                      Prepared By: <span className="font-bold text-slate-800">{booking.createdByName}</span> ({booking.createdByRole})
                    </div>
                  </div>
                </div>

                {/* Items Table: Mobile-Horizontal-Scrollable on screen, 100% full-width on print */}
                <div className="sheet-card border border-slate-200 rounded-xl sm:rounded-2xl overflow-x-auto print:overflow-visible">
                  <table className="w-full text-left border-collapse min-w-[560px] sm:min-w-full">
                    <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                      <tr>
                        <th className="py-2 px-3 text-center w-10">#</th>
                        <th className="py-2 px-3">Item Description</th>
                        <th className="py-2 px-3 text-left">Color</th>
                        <th className="py-2 px-3 text-center">Size</th>
                        <th className="py-2 px-3 text-center">Qty</th>
                        <th className="py-2 px-3 text-right">Unit Price (EGP)</th>
                        <th className="py-2 px-3 text-right">Line Total (EGP)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs bg-white">
                      {booking.items.map((it, idx) => (
                        <tr key={it.id}>
                          <td className="py-2 px-3 font-mono text-slate-400 font-bold text-center">{idx + 1}</td>
                          <td className="py-2 px-3 font-black text-slate-900">{it.productName}</td>
                          <td className="py-2 px-3 text-left">
                            <span className="inline-flex items-center gap-1.5 font-medium">
                              <span
                                className="w-3 h-3 rounded-full border border-slate-300 inline-block shrink-0 shadow-2xs"
                                style={{ backgroundColor: it.colorHex }}
                              />
                              <span className="text-slate-800 font-semibold">{it.colorName}</span>
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center font-mono font-bold text-slate-800">{it.size}</td>
                          <td className="py-2 px-3 text-center font-mono font-black text-slate-900">
                            {it.quantity}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-semibold text-slate-700">
                            {it.unitPrice.toFixed(2)} EGP
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-black text-slate-900">
                            {it.totalPrice.toFixed(2)} EGP
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Financial Summary Box (Aligned Right) */}
                <div className="sheet-card flex justify-end pt-0.5">
                  <div className="w-full sm:w-96 bg-slate-50/90 border border-slate-200 rounded-xl sm:rounded-2xl p-3.5 sm:p-4 space-y-1.5 shadow-2xs">
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>Subtotal:</span>
                      <span className="font-mono font-bold text-slate-900">{booking.subtotal.toFixed(2)} EGP</span>
                    </div>

                    {booking.discount > 0 && (
                      <div className="flex justify-between text-xs text-rose-600 font-bold">
                        <span>Discount:</span>
                        <span className="font-mono">-{booking.discount.toFixed(2)} EGP</span>
                      </div>
                    )}

                    <div className="pt-1.5 border-t border-slate-200 flex justify-between text-sm sm:text-base font-black text-slate-900">
                      <span>Total Order Value:</span>
                      <span className="font-mono text-blue-900 text-sm sm:text-base font-black">{booking.total.toFixed(2)} EGP</span>
                    </div>

                    {/* Deposit Breakdown */}
                    {booking.status === 'done' ? (
                      <div className="pt-2 border-t border-dashed border-slate-300 space-y-1.5 text-xs">
                        <div className="flex justify-between font-bold text-emerald-900 text-xs">
                          <span>Total Amount Paid:</span>
                          <span className="font-mono text-emerald-950 font-black">{booking.total.toFixed(2)} EGP (100% Settled)</span>
                        </div>

                        <div className="flex justify-between text-xs text-slate-600">
                          <span>Payment Status:</span>
                          <span className="font-mono font-black text-emerald-700">
                            ✓ 100% FULLY PAID & SETTLED
                          </span>
                        </div>

                        <div className="flex justify-between font-bold text-slate-800 pt-1.5 border-t border-slate-200">
                          <span>Remaining Balance:</span>
                          <span className="font-mono font-black text-emerald-700">
                            0.00 EGP
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="pt-2 border-t border-dashed border-slate-300 space-y-1.5 text-xs">
                        <div className="flex justify-between font-bold text-amber-900 text-xs">
                          <span>{depositPct === 100 ? '100% Full Payment Required:' : `${depositPct}% Required Advance Deposit:`}</span>
                          <span className="font-mono text-amber-950 font-black">{booking.depositRequired.toFixed(2)} EGP</span>
                        </div>

                        <div className="flex justify-between text-xs text-slate-600">
                          <span>Deposit Payment Status:</span>
                          <span className={`font-mono font-black ${booking.depositPaid ? 'text-emerald-700' : 'text-amber-800'}`}>
                            {booking.depositPaid
                              ? 'RECEIVED & CONFIRMED'
                              : (depositPct === 100 ? 'PENDING FULL PAYMENT' : `PENDING ${depositPct}% PAYMENT`)}
                          </span>
                        </div>

                        <div className="flex justify-between font-bold text-slate-800 pt-1.5 border-t border-slate-200">
                          <span>{depositPct === 100 ? 'Remaining Balance:' : `${remainingPct}% Balance (Due on Handover):`}</span>
                          <span className="font-mono font-black">
                            {Math.max(0, booking.total - booking.depositRequired).toFixed(2)} EGP
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Terms & Official Sign-off Footer: Fits cleanly inside 1-page A4 */}
                <div className="sheet-card pt-2 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-[10px] text-slate-500">
                  <div className="text-center sm:text-left">
                    {booking.status === 'done' ? (
                      <p className="font-semibold text-emerald-800">
                        • Order completed & delivered. Full payment of {booking.total.toFixed(2)} EGP received and settled in full.
                      </p>
                    ) : depositPct === 100 ? (
                      <p className="font-medium text-slate-600">
                        • Full 100% payment required to confirm booking and commence workshop production schedule.
                      </p>
                    ) : (
                      <>
                        <p className="font-medium text-slate-600">
                          • {depositPct}% advance deposit confirms booking and secures workshop manufacturing schedule.
                        </p>
                        <p className="font-medium text-slate-600">
                          • Remaining {remainingPct}% balance payable upon physical delivery & quality inspection.
                        </p>
                      </>
                    )}
                  </div>
                  <div className="text-center sm:text-right shrink-0">
                    <div className="h-9 border-b border-dashed border-slate-300 w-44 flex items-end justify-center pb-0.5">
                      <span className="text-[10px] font-bold text-slate-700">Saint Paul Scouts Warehouse</span>
                    </div>
                    <div className="text-[9px] text-slate-400 mt-0.5">Authorized Officer Signature</div>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================== */}
            {/* DOCUMENT 2: WORKSHOP PRODUCTION & DEFICIT SHEET                */}
            {/* ============================================================== */}
            {docType === 'production' && (
              <div className="space-y-4 sm:space-y-5">
                {/* Header */}
                <div className="sheet-card flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b-2 border-slate-900 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white border border-slate-200/90 shadow-2xs p-1 flex items-center justify-center shrink-0 overflow-hidden">
                      <img
                        src="/sps-logo.png"
                        alt="Saint Paul Scouts"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div>
                      <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-950 uppercase">
                        Workshop Production & Deficit Sheet
                      </h1>
                      <p className="text-xs font-semibold text-amber-800 mt-0.5">
                        Saint Paul Scouts Tailoring & Cutting Division
                      </p>
                      <div className="text-[10px] text-slate-500 mt-1 font-mono">
                        Target Order Reference: <span className="font-bold text-slate-900">{booking.bookingNumber}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-left sm:text-right">
                    <span className="inline-block px-3 py-1 rounded bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider mb-1">
                      Workshop Production
                    </span>
                    <div className="text-[11px] text-slate-600 font-bold mt-0.5">
                      Date Issued: {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Client: <span className="font-bold text-slate-800">{booking.clientName}</span>
                    </div>
                  </div>
                </div>

                {/* Deficit Notice Banner */}
                <div className="sheet-card bg-slate-950 text-white rounded-xl sm:rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                      Manufacturing Quota Summary
                    </div>
                    <div className="text-base sm:text-lg font-black mt-0.5">
                      {totalDeficit > 0 ? (
                        <span>Deficit Units to Manufacture: <span className="text-amber-400 font-mono">{totalDeficit}</span> units</span>
                      ) : (
                        <span className="text-emerald-400">All requested units currently available in warehouse stock</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Recommended total production (covering deficit + buffer replenishments):{' '}
                      <strong className="text-white font-mono">{totalRecommendedProduction} units</strong>
                    </p>
                  </div>

                  <div className="sm:text-right font-mono text-xs border-t sm:border-t-0 border-slate-800 pt-2 sm:pt-0">
                    <div className="text-slate-400">Total Booking:</div>
                    <div className="text-base font-bold text-white">{totalUnits} units</div>
                  </div>
                </div>

                {/* Workshop Deficit Table */}
                <div className="sheet-card border border-slate-200 rounded-xl sm:rounded-2xl overflow-x-auto print:overflow-visible">
                  <table className="w-full text-left border-collapse min-w-[580px] sm:min-w-full">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                      <tr>
                        <th className="py-2 px-3">Item Description</th>
                        <th className="py-2 px-3 text-center">Color</th>
                        <th className="py-2 px-3 text-center">Size</th>
                        <th className="py-2 px-3 text-center">Client Ordered</th>
                        <th className="py-2 px-3 text-center">Warehouse Stock</th>
                        <th className="py-2 px-3 text-center bg-amber-50 text-amber-950 font-black">
                          DEFICIT TO PRODUCE
                        </th>
                        <th className="py-2 px-3 text-center">Min Threshold</th>
                        <th className="py-2 px-3 text-center bg-blue-50 text-blue-950 font-bold">
                          Rec. Production
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs bg-white">
                      {booking.items.map((it) => {
                        const hasDeficit = it.deficitQuantity > 0;
                        return (
                          <tr
                            key={it.id}
                            className={hasDeficit ? 'bg-amber-50/40 font-medium' : 'hover:bg-slate-50/50'}
                          >
                            <td className="py-2 px-3">
                              <div className="font-bold text-slate-900">{it.productName}</div>
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span className="inline-flex items-center gap-1">
                                <span
                                  className="w-2.5 h-2.5 rounded-full border border-slate-300"
                                  style={{ backgroundColor: it.colorHex }}
                                />
                                <span>{it.colorName}</span>
                              </span>
                            </td>
                            <td className="py-2 px-3 text-center font-mono font-bold">
                              {it.size}
                            </td>
                            <td className="py-2 px-3 text-center font-mono font-bold text-slate-900">
                              {it.quantity}
                            </td>
                            <td className="py-2 px-3 text-center font-mono text-slate-600">
                              {it.availableStock}
                            </td>
                            <td className="py-2 px-3 text-center font-mono font-black bg-amber-100/60 text-amber-950">
                              {hasDeficit ? (
                                <span className="inline-block px-2 py-0.5 rounded bg-rose-600 text-white font-bold">
                                  {it.deficitQuantity}
                                </span>
                              ) : (
                                <span className="text-slate-400 font-normal">0</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-center font-mono text-slate-500">
                              {it.minThreshold || 5}
                            </td>
                            <td className="py-2 px-3 text-center font-mono font-black text-blue-900 bg-blue-50/60">
                              {it.recommendedProduction || it.deficitQuantity}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Workshop Checklist */}
                <div className="sheet-card bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl p-3.5 sm:p-4 space-y-2.5">
                  <div className="font-bold text-xs uppercase tracking-wider text-slate-700">
                    Workshop Production Quality & Milestone Sign-offs
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                    <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                      <div className="font-bold text-slate-900 mb-0.5 flex items-center gap-1.5">
                        <input type="checkbox" className="w-3.5 h-3.5 rounded" />
                        <span>1. Fabric Cutting</span>
                      </div>
                      <div className="text-[10px] text-slate-500">Pattern cut for all deficit sizes</div>
                    </div>

                    <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                      <div className="font-bold text-slate-900 mb-0.5 flex items-center gap-1.5">
                        <input type="checkbox" className="w-3.5 h-3.5 rounded" />
                        <span>2. Assembly & Stitching</span>
                      </div>
                      <div className="text-[10px] text-slate-500">Sewing, overlocking & hems</div>
                    </div>

                    <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                      <div className="font-bold text-slate-900 mb-0.5 flex items-center gap-1.5">
                        <input type="checkbox" className="w-3.5 h-3.5 rounded" />
                        <span>3. Badges & Print</span>
                      </div>
                      <div className="text-[10px] text-slate-500">Scout badge embroidery applied</div>
                    </div>

                    <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                      <div className="font-bold text-slate-900 mb-0.5 flex items-center gap-1.5">
                        <input type="checkbox" className="w-3.5 h-3.5 rounded" />
                        <span>4. Ironing & Pack</span>
                      </div>
                      <div className="text-[10px] text-slate-500">Folded and labeled with SKU</div>
                    </div>
                  </div>
                </div>

                {/* Signatures */}
                <div className="sheet-card pt-4 border-t border-slate-200 grid grid-cols-2 gap-6 text-center text-[10px] text-slate-600">
                  <div>
                    <div className="h-10 border-b border-dashed border-slate-300 flex items-end justify-center pb-1">
                      <span className="font-semibold text-slate-700">Workshop Tailor Supervisor</span>
                    </div>
                    <div className="mt-1">Production Supervisor Verification</div>
                  </div>

                  <div>
                    <div className="h-10 border-b border-dashed border-slate-300 flex items-end justify-center pb-1">
                      <span className="font-semibold text-slate-700">Warehouse Receiving Officer</span>
                    </div>
                    <div className="mt-1">Finished Goods Warehouse Handover</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

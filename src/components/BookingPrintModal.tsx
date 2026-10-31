import React, { useState } from 'react';
import { Booking } from '../types/inventory';
import {
  Printer,
  X,
  FileText,
  Factory,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Layers,
  ArrowRight,
  ShieldAlert,
  Package,
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
  const [includeNotes, setIncludeNotes] = useState<boolean>(
    Boolean(booking?.notes && booking.notes.trim().length > 0)
  );

  if (!isOpen || !booking) return null;

  const handlePrint = () => {
    window.print();
  };

  const totalUnits = booking.items.reduce((acc, it) => acc + it.quantity, 0);
  const totalDeficit = booking.items.reduce((acc, it) => acc + it.deficitQuantity, 0);
  const totalRecommendedProduction = booking.items.reduce(
    (acc, it) => acc + (it.recommendedProduction || it.deficitQuantity),
    0
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      {/* Modal Container */}
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl my-0 sm:my-6 flex flex-col max-h-[95vh] overflow-hidden">
        {/* Top Control Bar (Hidden when printing via CSS @media print) */}
        <div className="print:hidden p-3.5 sm:p-4 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center justify-between w-full sm:w-auto">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                <Printer className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <div className="text-xs sm:text-sm font-black flex items-center gap-2">
                  <span>Print Document</span>
                  <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-white/10 text-amber-300">
                    {booking.bookingNumber}
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-slate-300">
                  A4 Standard Printable & PDF
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="sm:hidden w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Switch Document Type, Notes Toggle & Print Action */}
          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
            {booking.notes && (
              <button
                type="button"
                onClick={() => setIncludeNotes(!includeNotes)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors flex items-center gap-1.5 ${
                  includeNotes
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                }`}
                title="Toggle displaying notes in print/PDF"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{includeNotes ? '✓ Notes Included' : 'Notes Excluded'}</span>
              </button>
            )}

            <div className="inline-flex p-1 bg-slate-800 rounded-xl border border-slate-700 flex-1 sm:flex-none">
              <button
                type="button"
                onClick={() => setDocType('quotation')}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  docType === 'quotation'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
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
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Factory className="w-3.5 h-3.5" />
                <span>Workshop Deficit</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              <Printer className="w-4 h-4" />
              <span>Print / PDF (A4)</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="hidden sm:flex w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Sheet Viewport */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100/60 print:bg-white print:p-0">
          {/* A4 Sheet Simulation */}
          <div
            id="printable-a4-area"
            className="w-full max-w-[210mm] min-h-[297mm] mx-auto bg-white border border-slate-200/90 shadow-lg p-6 sm:p-10 font-sans text-slate-900 print:border-none print:shadow-none print:p-6 print:m-0 print:w-full print:max-w-none text-xs leading-relaxed"
          >
            {/* DOCUMENT 1: CLIENT QUOTATION */}
            {docType === 'quotation' && (
              <div className="space-y-6">
                {/* Header without app logo & without Apparel & Uniform line */}
                <div className="flex items-start justify-between border-b-2 border-slate-900 pb-5">
                  <div>
                    <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
                      Saint Paul Scouts Warehouse
                    </h1>
                    <div className="text-[11px] text-slate-600 flex flex-wrap items-center gap-4 mt-2 font-medium">
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

                  <div className="text-right">
                    <span className="inline-block px-3 py-1 rounded bg-blue-50 text-blue-900 border border-blue-200 font-mono font-black text-xs uppercase tracking-wider mb-1">
                      Official Quotation
                    </span>
                    <div className="font-mono font-bold text-sm text-slate-900">
                      {booking.bookingNumber}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Date:{' '}
                      <span className="font-semibold text-slate-800">
                        {new Date(booking.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Client & Booking Summary Info */}
                <div className="grid grid-cols-2 gap-4 bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider font-black text-slate-500 mb-1">
                      Quotation Prepared For
                    </div>
                    <div className="text-sm font-black text-slate-900">{booking.clientName}</div>
                    <div className="text-xs text-slate-600 mt-0.5">
                      Phone: <span className="font-semibold">{booking.clientPhone}</span>
                    </div>
                    {booking.notes && (
                      <div className="text-[11px] text-slate-600 mt-1 italic">
                        Notes: {booking.notes}
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider font-black text-slate-500 mb-1">
                      Status & Terms
                    </div>
                    <div>
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-md font-bold text-[11px] uppercase tracking-wide border ${
                          booking.status === 'pending'
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : booking.status === 'preparing'
                            ? 'bg-blue-100 text-blue-900 border-blue-300'
                            : booking.status === 'delivered'
                            ? 'bg-purple-100 text-purple-900 border-purple-300'
                            : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                        }`}
                      >
                        {booking.status === 'pending'
                          ? 'Awaiting 50% Deposit'
                          : booking.status === 'preparing'
                          ? 'In Preparation / Stock Reserved'
                          : booking.status === 'delivered'
                          ? 'Delivered (Awaiting Balance)'
                          : 'Order Completed'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Prepared By: <span className="font-bold text-slate-800">{booking.createdByName}</span> ({booking.createdByRole})
                    </div>
                  </div>
                </div>

                {/* Itemized Table */}
                <div>
                  <table className="w-full text-left border-collapse border border-slate-200 rounded-xl overflow-hidden">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Item Description</th>
                        <th className="py-2.5 px-3 text-center">Color</th>
                        <th className="py-2.5 px-3 text-center">Size</th>
                        <th className="py-2.5 px-3 text-center">Qty</th>
                        <th className="py-2.5 px-3 text-right">Unit Price (EGP)</th>
                        <th className="py-2.5 px-3 text-right">Line Total (EGP)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                      {booking.items.map((it, idx) => (
                        <tr key={it.id}>
                          <td className="py-2.5 px-3 font-mono text-slate-400">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">{it.productName}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="inline-flex items-center gap-1 font-medium">
                              <span
                                className="w-2.5 h-2.5 rounded-full border border-slate-300 inline-block"
                                style={{ backgroundColor: it.colorHex }}
                              />
                              <span>{it.colorName}</span>
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold">{it.size}</td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900">
                            {it.quantity}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-700">
                            {it.unitPrice.toFixed(2)} EGP
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            {it.totalPrice.toFixed(2)} EGP
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Financial Summary & Deposit Calculations */}
                <div className="flex justify-end">
                  <div className="w-full sm:w-80 space-y-2 bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>Subtotal:</span>
                      <span className="font-mono font-bold text-slate-800">{booking.subtotal.toFixed(2)} EGP</span>
                    </div>

                    {booking.discount > 0 && (
                      <div className="flex justify-between text-xs text-rose-600">
                        <span>Discount:</span>
                        <span className="font-mono font-bold">-{booking.discount.toFixed(2)} EGP</span>
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-black text-slate-900">
                      <span>Total Order Value:</span>
                      <span className="font-mono text-blue-900">{booking.total.toFixed(2)} EGP</span>
                    </div>

                    {/* Deposit Breakdown */}
                    <div className="pt-2.5 border-t border-dashed border-slate-300 space-y-1.5 text-xs">
                      <div className="flex justify-between font-bold text-amber-900">
                        <span>50% Required Advance Deposit:</span>
                        <span className="font-mono">{booking.depositRequired.toFixed(2)} EGP</span>
                      </div>

                      <div className="flex justify-between text-[11px] text-slate-600">
                        <span>Deposit Payment Status:</span>
                        <span className={`font-bold ${booking.depositPaid ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {booking.depositPaid ? 'RECEIVED & CONFIRMED' : 'PENDING 50% PAYMENT'}
                        </span>
                      </div>

                      <div className="flex justify-between font-bold text-slate-700 pt-1 border-t border-slate-200">
                        <span>50% Balance (Due on Handover):</span>
                        <span className="font-mono">
                          {(booking.total - booking.depositRequired).toFixed(2)} EGP
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Official Terms & Policy Box */}
                <div className="p-4 bg-amber-50/90 border border-amber-300 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-amber-950 font-bold text-xs uppercase tracking-wide">
                    <ShieldAlert className="w-4 h-4 text-amber-700" />
                    <span>Official Order & Manufacturing Policy</span>
                  </div>
                  <ul className="list-disc list-inside text-[11px] text-amber-900 space-y-1 leading-relaxed">
                    <li>
                      <strong>Work Commencement:</strong> Physical preparation, stock reservation, and workshop tailoring production will <strong>NOT</strong> begin until the mandatory <strong>50% advance deposit</strong> has been received and verified.
                    </li>
                    <li>
                      <strong>Final Balance:</strong> The remaining 50% balance must be settled in full upon delivery and handover of all finished items.
                    </li>
                    <li>
                      <strong>Manufacturing Timeline:</strong> Estimated workshop production lead times commence from the exact date of deposit verification.
                    </li>
                  </ul>
                </div>

                {/* Signatures & Stamp */}
                <div className="pt-8 border-t border-slate-200 grid grid-cols-2 gap-8 text-center text-[11px] text-slate-600">
                  <div>
                    <div className="h-14 border-b border-dashed border-slate-300 flex items-end justify-center pb-1">
                      <span className="font-bold text-slate-800">{booking.clientName}</span>
                    </div>
                    <div className="mt-1 font-semibold">Client Acceptance Signature</div>
                  </div>

                  <div>
                    <div className="h-14 border-b border-dashed border-slate-300 flex items-end justify-center pb-1">
                      <span className="font-bold text-slate-800">Saint Paul Scouts Warehouse Official</span>
                    </div>
                    <div className="mt-1 font-semibold">Authorized Signature & Warehouse Stamp</div>
                  </div>
                </div>
              </div>
            )}

            {/* DOCUMENT 2: WORKSHOP PRODUCTION & DEFICIT SHEET */}
            {docType === 'production' && (
              <div className="space-y-6">
                {/* Header without app logo */}
                <div className="flex items-start justify-between border-b-2 border-slate-900 pb-5">
                  <div>
                    <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
                      Workshop Production & Deficit Sheet
                    </h1>
                    <p className="text-xs font-semibold text-amber-800">
                      Saint Paul Scouts Tailoring & Cutting Division
                    </p>
                    <div className="text-[10px] text-slate-500 mt-1 font-mono">
                      Target Order Reference: <span className="font-bold text-slate-900">{booking.bookingNumber}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="inline-block px-3 py-1 rounded bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider mb-1">
                      Workshop Production
                    </span>
                    <div className="text-[11px] text-slate-600 font-bold mt-1">
                      Date Issued: {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Client: <span className="font-bold text-slate-800">{booking.clientName}</span>
                    </div>
                  </div>
                </div>

                {/* Deficit Notice Banner */}
                <div className="bg-slate-900 text-white rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                      Manufacturing Quota Summary
                    </div>
                    <div className="text-lg font-black mt-0.5">
                      {totalDeficit > 0 ? (
                        <span>Deficit Units to Manufacture: <span className="text-amber-400 font-mono">{totalDeficit}</span> units</span>
                      ) : (
                        <span className="text-emerald-400">All requested units currently available in warehouse stock</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Recommended total production (covering order deficit + safety replenishments):{' '}
                      <strong className="text-white font-mono">{totalRecommendedProduction} units</strong>
                    </p>
                  </div>

                  <div className="text-right font-mono text-xs">
                    <div className="text-slate-400">Total Booking:</div>
                    <div className="text-base font-bold text-white">{totalUnits} units</div>
                  </div>
                </div>

                {/* Workshop Deficit Table */}
                <div>
                  <table className="w-full text-left border-collapse border border-slate-200 rounded-xl overflow-hidden">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3">Item Description</th>
                        <th className="py-2.5 px-3 text-center">Color</th>
                        <th className="py-2.5 px-3 text-center">Size</th>
                        <th className="py-2.5 px-3 text-center">Client Ordered</th>
                        <th className="py-2.5 px-3 text-center">Warehouse Stock</th>
                        <th className="py-2.5 px-3 text-center bg-amber-50 text-amber-950 font-black">
                          DEFICIT TO PRODUCE
                        </th>
                        <th className="py-2.5 px-3 text-center">Min Threshold</th>
                        <th className="py-2.5 px-3 text-center bg-blue-50 text-blue-950 font-bold">
                          Rec. Production
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                      {booking.items.map((it) => {
                        const hasDeficit = it.deficitQuantity > 0;
                        return (
                          <tr
                            key={it.id}
                            className={hasDeficit ? 'bg-amber-50/40 font-medium' : 'hover:bg-slate-50/50'}
                          >
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-slate-900">{it.productName}</div>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className="inline-flex items-center gap-1">
                                <span
                                  className="w-2.5 h-2.5 rounded-full border border-slate-300"
                                  style={{ backgroundColor: it.colorHex }}
                                />
                                <span>{it.colorName}</span>
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-sm">
                              {it.size}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900">
                              {it.quantity}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                              {it.availableStock}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-black text-sm bg-amber-100/60 text-amber-950">
                              {hasDeficit ? (
                                <span className="inline-block px-2 py-0.5 rounded bg-rose-600 text-white font-bold">
                                  {it.deficitQuantity}
                                </span>
                              ) : (
                                <span className="text-slate-400 font-normal">0</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono text-slate-500">
                              {it.minThreshold || 5}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-black text-blue-900 bg-blue-50/60">
                              {it.recommendedProduction || it.deficitQuantity}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Workshop Checklist */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="font-bold text-xs uppercase tracking-wider text-slate-700">
                    Workshop Production Quality & Milestone Sign-offs
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 bg-white border border-slate-200 rounded-lg">
                      <div className="font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                        <input type="checkbox" className="w-3.5 h-3.5 rounded" />
                        <span>1. Fabric Cutting</span>
                      </div>
                      <div className="text-[10px] text-slate-500">Pattern cut for all deficit sizes</div>
                    </div>

                    <div className="p-3 bg-white border border-slate-200 rounded-lg">
                      <div className="font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                        <input type="checkbox" className="w-3.5 h-3.5 rounded" />
                        <span>2. Assembly & Stitching</span>
                      </div>
                      <div className="text-[10px] text-slate-500">Sewing, overlocking & hems</div>
                    </div>

                    <div className="p-3 bg-white border border-slate-200 rounded-lg">
                      <div className="font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                        <input type="checkbox" className="w-3.5 h-3.5 rounded" />
                        <span>3. Badges & Print</span>
                      </div>
                      <div className="text-[10px] text-slate-500">Scout badge embroidery applied</div>
                    </div>

                    <div className="p-3 bg-white border border-slate-200 rounded-lg">
                      <div className="font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                        <input type="checkbox" className="w-3.5 h-3.5 rounded" />
                        <span>4. Ironing & Pack</span>
                      </div>
                      <div className="text-[10px] text-slate-500">Folded and labeled with SKU</div>
                    </div>
                  </div>
                </div>

                {/* Signatures */}
                <div className="pt-8 border-t border-slate-200 grid grid-cols-2 gap-8 text-center text-[11px] text-slate-600">
                  <div>
                    <div className="h-12 border-b border-dashed border-slate-300 flex items-end justify-center pb-1">
                      <span className="font-semibold text-slate-700">Workshop Tailor Supervisor</span>
                    </div>
                    <div className="mt-1">Production Supervisor Verification</div>
                  </div>

                  <div>
                    <div className="h-12 border-b border-dashed border-slate-300 flex items-end justify-center pb-1">
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

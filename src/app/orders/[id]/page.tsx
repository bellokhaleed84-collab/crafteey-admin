"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { naira, dateTime } from "@/lib/format";
import { statusLabel, statusStyle } from "@/lib/orderStatus";

type Detail = {
  order: {
    _id: string;
    orderNumber: string;
    status: string;
    vendorName: string;
    vehicleType: string;
    items: { name: string; unitPriceKobo: number; quantity: number }[];
    subtotalKobo: number;
    deliveryFeeKobo: number;
    totalKobo: number;
    payment: { status: string; paidAt: string | null; channel: string; reference: string };
    delivery: { address?: string; phone?: string; note?: string };
    createdAt: string;
    vendorAcceptedAt: string | null;
    readyForPickupAt: string | null;
    cancelledBy: string | null;
    cancelReason: string | null;
    refund: { status?: string; method?: string; amountKobo?: number; refundedAt?: string } | null;
  };
  customer: { name: string; email: string; phone: string } | null;
  courier: { status: string; name: string | null; phone: string | null; earningKobo?: number | null } | null;
  split: {
    vendorTier: string;
    vendorPayoutKobo: number;
    platformVendorRevenueKobo: number;
    riderEarningKobo: number;
    platformCommissionKobo: number;
  } | null;
};

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-bold text-slate-900">{title}</h2>
      {children}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: React.ReactNode; bold?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={`text-right ${bold ? "font-bold text-slate-900" : "text-slate-700"}`}>{value}</span>
    </div>
  );
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { getIdToken } = useAdminAuth();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getIdToken();
        if (!token) return;
        const res = await fetch(`/api/admin/orders/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || "Couldn't load this order.");
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load this order.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getIdToken, id]);

  if (error) {
    return (
      <div className="space-y-4">
        <Link href="/orders" className="text-sm font-semibold text-slate-500 underline">
          Back to orders
        </Link>
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      </div>
    );
  }
  if (!data) return <p className="text-sm text-slate-400">Loading…</p>;

  const { order, customer, courier, split } = data;
  const timeline: [string, string | null][] = [
    ["Placed", order.createdAt],
    ["Paid", order.payment.paidAt],
    ["Vendor accepted", order.vendorAcceptedAt],
    ["Ready for pickup", order.readyForPickupAt],
  ];

  return (
    <div className="space-y-5">
      <Link href="/orders" className="text-sm font-semibold text-slate-500 underline">
        Back to orders
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{order.orderNumber}</h1>
          <p className="text-sm text-slate-500">{order.vendorName}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusStyle(order.status)}`}>
          {statusLabel(order.status)}
        </span>
      </div>

      {(order.cancelledBy || order.refund) && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {order.cancelledBy && (
            <p>
              Cancelled by the {order.cancelledBy}
              {order.cancelReason ? `: ${order.cancelReason}` : "."}
            </p>
          )}
          {order.refund && (
            <p className="mt-1">
              Refunded {naira(order.refund.amountKobo)} to the customer&apos;s {order.refund.method}
              {order.refund.refundedAt ? ` on ${dateTime(order.refund.refundedAt)}` : ""}.
            </p>
          )}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title="Items">
            <div className="divide-y divide-slate-100">
              {order.items.map((it, i) => (
                <div key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="text-slate-700">
                    {it.quantity} × {it.name}
                  </span>
                  <span className="font-semibold text-slate-900">{naira(it.unitPriceKobo * it.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 border-t border-slate-100 pt-3">
              <Row label="Subtotal" value={naira(order.subtotalKobo)} />
              <Row label="Delivery fee" value={naira(order.deliveryFeeKobo)} />
              <Row label="Total paid" value={naira(order.totalKobo)} bold />
              <Row label="Payment" value={`${order.payment.status || "unknown"}${order.payment.channel ? ` · ${order.payment.channel}` : ""}`} />
              {order.payment.reference && <Row label="Paystack reference" value={<span className="break-all font-mono text-xs">{order.payment.reference}</span>} />}
            </div>
          </Card>

          {split && (
            <Card title="Revenue split">
              <Row label="Vendor tier" value={<span className="capitalize">{split.vendorTier}</span>} />
              <Row label="Vendor payout" value={naira(split.vendorPayoutKobo)} />
              <Row label="Platform revenue from vendor" value={naira(split.platformVendorRevenueKobo)} />
              <Row label="Rider earning" value={naira(split.riderEarningKobo)} />
              <Row label="Platform delivery commission" value={naira(split.platformCommissionKobo)} />
              <Row
                label="Platform revenue in total"
                value={naira(split.platformVendorRevenueKobo + split.platformCommissionKobo)}
                bold
              />
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card title="Customer">
            {customer ? (
              <>
                <Row label="Name" value={customer.name} />
                <Row label="Phone" value={<a href={`tel:${customer.phone}`} className="underline">{customer.phone}</a>} />
                <Row label="Email" value={<span className="break-all">{customer.email}</span>} />
              </>
            ) : (
              <p className="text-sm text-slate-400">Customer record not found.</p>
            )}
          </Card>

          <Card title="Delivery">
            <Row label="Address" value={order.delivery.address || "Not given"} />
            {order.delivery.phone && <Row label="Phone on order" value={order.delivery.phone} />}
            {order.delivery.note && <Row label="Note" value={order.delivery.note} />}
            <Row label="Vehicle" value={<span className="capitalize">{order.vehicleType}</span>} />
          </Card>

          <Card title="Rider">
            {courier ? (
              <>
                <Row label="Delivery status" value={<span className="capitalize">{statusLabel(courier.status)}</span>} />
                <Row label="Name" value={courier.name || "Not accepted yet"} />
                {courier.phone && <Row label="Phone" value={<a href={`tel:${courier.phone}`} className="underline">{courier.phone}</a>} />}
              </>
            ) : (
              <p className="text-sm text-slate-400">No delivery request has been created for this order yet.</p>
            )}
          </Card>

          <Card title="Timeline">
            {timeline
              .filter(([, t]) => t)
              .map(([label, t]) => (
                <Row key={label} label={label} value={dateTime(t)} />
              ))}
          </Card>
        </div>
      </div>
    </div>
  );
}